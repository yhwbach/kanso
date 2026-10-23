import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "@/home/entities/user.entity";
import { Home, HomeDocument } from "@/home/entities/home.entity";
import { Device, DeviceDocument } from "@/home/entities/device.entity";
import { ConnectedDevice, ConnectedDeviceDocument, type ConnectedKind } from "@/home/entities/connected-device.entity";
import { DOMAIN_EVENTS, type DeviceUnreachableEvent, type DeviceUpdatedEvent, type DeviceView, type TimerEvent } from "@/platform/events/domain-events";
import { ENVIRONMENTS } from "@/home/environments";
import type { ActionResultView, ConnectedDeviceView, DeviceStateView, HomeView, TimerView, UserView } from "@/home/dto/home.dto";

const RESTART_DELAY_MS = 1200;

type PendingCommand = { deviceId: string; on: boolean };

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);
  private readonly timers = new Map<string, TimerView & { userId: string; handle: NodeJS.Timeout }>();
  private readonly pendingByHub = new Map<string, PendingCommand[]>();
  private activeUserId: string | null = null;

  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Home.name) private readonly homes: Model<HomeDocument>,
    @InjectModel(Device.name) private readonly devices: Model<DeviceDocument>,
    @InjectModel(ConnectedDevice.name) private readonly connected: Model<ConnectedDeviceDocument>,
    private readonly events: EventEmitter2,
  ) {}

  async onboard(input: { name: string; homeName: string; template: string; privacyEnabled: boolean }) {
    const user = await this.users.create({ name: input.name.trim().slice(0, 40) || "Friend", privacyEnabled: input.privacyEnabled });
    const home = await this.createHome(user._id.toString(), { name: input.homeName, template: input.template });
    this.activeUserId = user._id.toString();
    this.logger.log(`Onboarded ${user.name} with home ${home.name}`);
    return this.snapshot(this.activeUserId);
  }

  async getUser(userId: string): Promise<UserView> {
    const user = await this.userDoc(userId);
    return this.userView(user);
  }

  async snapshot(userId: string) {
    const user = await this.userDoc(userId);
    const homes = await this.listHomes(userId);
    const activeHome = homes.find((h) => h.id === user.activeHomeId?.toString()) ?? homes[0];
    if (!activeHome) throw new NotFoundException("This user has no home yet");
    return {
      user: this.userView(user),
      homes,
      activeHome,
      devices: await this.listDevices(userId),
      connected: await this.listConnected(userId, activeHome.id),
      timers: this.listTimers(userId),
    };
  }

  async setActiveUser(userId: string) {
    await this.userDoc(userId);
    this.activeUserId = userId;
  }

  /**
   * MCP calls arrive without a session, so tools fall back to the most recently
   * onboarded user. The web app always passes its own id.
   */
  async resolveUserId(userId?: string): Promise<string> {
    if (userId && Types.ObjectId.isValid(userId)) return userId;
    if (this.activeUserId) return this.activeUserId;
    const latest = await this.users.findOne().sort({ createdAt: -1 }).exec();
    if (!latest) throw new NotFoundException("No one has set up Kanso yet. Open the web app first.");
    this.activeUserId = latest._id.toString();
    return this.activeUserId;
  }

  async listHomes(userId: string): Promise<HomeView[]> {
    const docs = await this.homes.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: 1 }).exec();
    const views: HomeView[] = [];
    for (const h of docs) views.push(await this.homeView(h));
    return views;
  }

  async createHome(userId: string, input: { name: string; template?: string; icon?: string }): Promise<HomeView> {
    const user = await this.userDoc(userId);
    const template = this.environmentKey(input.template ?? input.name);
    const home = await this.homes.create({ userId: user._id, name: input.name.trim().slice(0, 40) || "Home", template, icon: input.icon?.trim() || undefined });
    await this.devices.insertMany(
      ENVIRONMENTS[template].devices.map((s) => ({
        userId: user._id,
        homeId: home._id,
        deviceId: s.deviceId,
        name: s.name,
        room: s.room,
        type: s.type,
        status: s.status ?? "online",
        isOn: s.isOn ?? false,
        locked: s.locked ?? false,
        temperature: s.temperature,
        hubId: s.hubId,
        aliases: s.aliases ?? [],
      })),
    );
    user.activeHomeId = home._id;
    await user.save();
    return this.homeView(home);
  }

  async updateHome(userId: string, homeId: string, input: { name?: string; icon?: string }): Promise<HomeView> {
    const home = await this.homeDoc(userId, homeId);
    if (input.name !== undefined) home.name = input.name.trim().slice(0, 40) || home.name;
    if (input.icon !== undefined) home.icon = input.icon.trim() || undefined;
    await home.save();
    return this.homeView(home);
  }

  async deleteHome(userId: string, homeId: string) {
    const user = await this.userDoc(userId);
    const all = await this.homes.find({ userId: user._id }).exec();
    if (all.length <= 1) throw new NotFoundException("Keep at least one home");
    const home = await this.homeDoc(userId, homeId);
    await this.devices.deleteMany({ homeId: home._id }).exec();
    await this.connected.deleteMany({ homeId: home._id }).exec();
    await home.deleteOne();
    if (user.activeHomeId?.toString() === homeId) {
      user.activeHomeId = all.find((h) => h._id.toString() !== homeId)!._id;
      await user.save();
    }
    return { ok: true };
  }

  async setActiveHome(userId: string, homeId: string): Promise<HomeView> {
    const user = await this.userDoc(userId);
    const home = await this.homeDoc(userId, homeId);
    user.activeHomeId = home._id;
    await user.save();
    return this.homeView(home);
  }

  async listConnected(userId: string, homeId?: string): Promise<ConnectedDeviceView[]> {
    const id = homeId ? new Types.ObjectId(homeId) : await this.activeHomeId(userId);
    const docs = await this.connected.find({ homeId: id }).sort({ createdAt: 1 }).exec();
    return docs.map((d) => ({ id: d._id.toString(), kind: d.kind, name: d.name, room: d.room, createdAt: d.createdAt! }));
  }

  async connectDevice(userId: string, homeId: string, input: { kind: ConnectedKind; name: string; room?: string }): Promise<ConnectedDeviceView> {
    const home = await this.homeDoc(userId, homeId);
    const d = await this.connected.create({ homeId: home._id, userId: home.userId, kind: input.kind, name: input.name.trim(), room: input.room?.trim() || undefined });
    return { id: d._id.toString(), kind: d.kind, name: d.name, room: d.room, createdAt: d.createdAt! };
  }

  async disconnectDevice(userId: string, homeId: string, connectedId: string) {
    const home = await this.homeDoc(userId, homeId);
    await this.connected.deleteOne({ _id: new Types.ObjectId(connectedId), homeId: home._id }).exec();
    return { ok: true };
  }

  async listDevices(userId: string): Promise<DeviceStateView[]> {
    const docs = await this.devices.find({ homeId: await this.activeHomeId(userId) }).sort({ room: 1, name: 1 }).exec();
    return docs.map((d) => this.toView(d));
  }

  async setPower(userId: string, query: string, on: boolean): Promise<ActionResultView> {
    const { device, candidates } = await this.findDevice(userId, query);
    if (!device) return this.notFound(query, candidates);
    if (device.type === "lock") return this.setLock(userId, query, !on);
    if (device.type === "hub") {
      if (!on) return { ok: false, error: "UNSUPPORTED", device: this.toView(device), message: `The ${this.lower(device.name)} needs to stay on so your other devices can reach it.` };
      if (device.status === "online") return { ok: true, device: this.toView(device), message: `The ${this.lower(device.name)} is already online.` };
      const restarted = await this.restartHub(userId, device.deviceId);
      return { ok: restarted.ok, device: restarted.ok ? restarted.hub : this.toView(device), message: restarted.message };
    }

    if (device.hubId) {
      const hub = await this.devices.findOne({ homeId: device.homeId, deviceId: device.hubId }).exec();
      if (hub && hub.status !== "online") return this.blockedByHub(userId, device, hub, on);
    }
    device.isOn = on;
    device.status = "online";
    await device.save();
    this.emitDevice(userId, device);
    return { ok: true, device: this.toView(device), message: `Okay, the ${this.lower(device.name)} ${this.be(device.name)} ${on ? "on" : "off"}.` };
  }

  async setLock(userId: string, query: string, locked: boolean): Promise<ActionResultView> {
    const { device, candidates } = await this.findDevice(userId, query);
    if (!device || device.type !== "lock") return this.notFound(query, candidates.filter((c) => c.type === "lock"));
    device.locked = locked;
    await device.save();
    this.emitDevice(userId, device);
    return { ok: true, device: this.toView(device), message: `Done, the ${this.lower(device.name)} ${this.be(device.name)} ${locked ? "locked" : "unlocked"}.` };
  }

  async setTemperature(userId: string, temperature: number): Promise<ActionResultView> {
    const device = await this.devices.findOne({ homeId: await this.activeHomeId(userId), type: "thermostat" }).exec();
    if (!device) return { ok: false, error: "DEVICE_NOT_FOUND", message: "No thermostat in this home." };
    device.temperature = Math.max(50, Math.min(90, Math.round(temperature)));
    device.isOn = true;
    await device.save();
    this.emitDevice(userId, device);
    return { ok: true, device: this.toView(device), message: `Okay, I've set the thermostat to ${device.temperature} degrees.` };
  }

  async status(userId: string, query: string): Promise<ActionResultView> {
    const { device, candidates } = await this.findDevice(userId, query);
    if (!device) return this.notFound(query, candidates);
    const n = this.lower(device.name);
    const message =
      device.type === "lock"
        ? device.locked
          ? `Yes, the ${n} ${this.be(device.name)} locked.`
          : `No, the ${n} ${this.be(device.name)} unlocked. Want me to lock it?`
        : device.type === "thermostat"
          ? `The thermostat is set to ${device.temperature} degrees right now.`
          : device.type === "hub"
            ? `The ${n} is ${device.status === "online" ? "online" : "offline right now"}.`
            : device.status === "online"
              ? `The ${n} ${this.be(device.name)} ${device.isOn ? "on" : "off"}.`
              : `I can't reach the ${n} right now.`;
    return { ok: true, device: this.toView(device), message };
  }

  async adjustTemperature(userId: string, delta: number): Promise<ActionResultView> {
    const thermostat = await this.devices.findOne({ homeId: await this.activeHomeId(userId), type: "thermostat" }).exec();
    if (!thermostat) return { ok: false, error: "DEVICE_NOT_FOUND", message: "There's no thermostat in this home." };
    const r = await this.setTemperature(userId, (thermostat.temperature ?? 70) + delta);
    return r.ok ? { ...r, message: `Okay, I've made it ${delta > 0 ? "warmer" : "cooler"}. The thermostat is now set to ${r.device!.temperature} degrees.` } : r;
  }

  async summary(userId: string, scope: "on" | "all"): Promise<{ ok: true; message: string }> {
    const devices = await this.listDevices(userId);
    const on = devices.filter((d) => d.isOn && ["light", "fan", "speaker"].includes(d.type)).map((d) => `the ${this.lower(d.name)}`);
    const unlocked = devices.filter((d) => d.type === "lock" && !d.locked).map((d) => `the ${this.lower(d.name)}`);
    const locks = devices.filter((d) => d.type === "lock");
    const offline = devices.filter((d) => d.status !== "online").map((d) => `the ${this.lower(d.name)}`);
    const thermostat = devices.find((d) => d.type === "thermostat");
    const onLine = on.length ? `${this.spokenList(on)} ${on.length === 1 && this.be(on[0]) === "is" ? "is" : "are"} on.` : "Nothing is on right now.";
    if (scope === "on") return { ok: true, message: onLine };
    const parts = [
      on.length ? onLine : "Everything is off.",
      locks.length ? (unlocked.length ? `${this.spokenList(unlocked)} ${unlocked.length === 1 ? "is" : "are"} unlocked.` : locks.length === 1 ? `The ${this.lower(locks[0].name)} is locked.` : "All the doors are locked.") : undefined,
      thermostat?.temperature !== undefined ? `The thermostat is set to ${thermostat.temperature} degrees.` : undefined,
      offline.length ? `${this.spokenList(offline)} ${offline.length === 1 ? "is" : "are"} offline.` : undefined,
    ];
    return { ok: true, message: parts.filter(Boolean).join(" ") };
  }

  async diagnose(userId: string, query: string) {
    const { device, candidates } = await this.findDevice(userId, query);
    if (!device) return { ...this.notFound(query, candidates), healthy: false, diagnosis: this.notFound(query, candidates).message, suggestedAction: null };
    const hub = device.type === "hub" ? device : device.hubId ? await this.devices.findOne({ homeId: device.homeId, deviceId: device.hubId }).exec() : null;
    const healthy = !hub || hub.status === "online";
    const name = this.lower(device.name);
    const diagnosis = healthy
      ? `The ${name} ${this.be(device.name)} working fine. Nothing needs fixing.`
      : hub === device
        ? `You're right, the ${name} is offline. I've put a restart button on screen, or you can say "restart the hub".`
        : `The ${name} ${this.be(device.name)} not responding because the ${this.lower(hub!.name)} is offline. I've put a restart button on screen.`;
    if (!healthy) {
      const event: DeviceUnreachableEvent = { userId, device: this.toView(device), hub: this.toView(hub!), diagnosis, suggestedAction: "restart_hub" };
      this.events.emit(DOMAIN_EVENTS.DEVICE_UNREACHABLE, event);
    }
    return { ok: true, message: diagnosis, device: this.toView(device), hub: hub ? this.toView(hub) : undefined, healthy, diagnosis, suggestedAction: healthy ? null : { tool: "restart_hub", hubId: hub!.deviceId } };
  }

  async restartHub(userId: string, hubQuery: string) {
    const homeId = await this.activeHomeId(userId);
    const { device: match } = await this.findDevice(userId, hubQuery);
    const hub = match?.type === "hub" ? match : await this.devices.findOne({ homeId, type: "hub" }).exec();
    if (!hub) return { ok: false, error: "DEVICE_NOT_FOUND" as const, message: "No hub found." };

    hub.status = "error";
    await hub.save();
    this.emitDevice(userId, hub, { restarting: true });
    await new Promise((r) => setTimeout(r, RESTART_DELAY_MS));
    hub.status = "online";
    await hub.save();
    this.emitDevice(userId, hub);

    const key = `${hub.homeId.toString()}:${hub.deviceId}`;
    const pending = this.pendingByHub.get(key) ?? [];
    this.pendingByHub.delete(key);
    const applied: DeviceView[] = [];
    for (const dep of await this.devices.find({ homeId: hub.homeId, hubId: hub.deviceId }).exec()) {
      const command = pending.find((p) => p.deviceId === dep.deviceId);
      dep.status = "online";
      if (command) dep.isOn = command.on;
      await dep.save();
      this.emitDevice(userId, dep);
      if (command) applied.push(this.toView(dep));
    }
    const message = applied.length
      ? `Done. I restarted the ${this.lower(hub.name)}, and the ${applied.map((a) => this.lower(a.name)).join(" and ")} ${applied.length === 1 ? this.be(applied[0].name) : "are"} ${applied.every((a) => a.isOn) ? "back on" : "updated"}.`
      : `Done. The ${this.lower(hub.name)} is back online.`;
    return { ok: true, hub: this.toView(hub), applied, message };
  }

  listTimers(userId: string): TimerView[] {
    return [...this.timers.values()].filter((t) => t.userId === userId).map((t) => this.stripTimer(t));
  }

  createTimer(userId: string, durationMs: number, label = "Timer"): TimerView {
    const id = `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date();
    const handle = setTimeout(() => {
      const t = this.timers.get(id);
      if (!t) return;
      this.timers.delete(id);
      this.events.emit(DOMAIN_EVENTS.TIMER_FINISHED, { userId, timer: this.stripTimer(t) } satisfies TimerEvent);
    }, durationMs);
    const timer = { id, userId, label, durationMs, endsAt: new Date(createdAt.getTime() + durationMs).toISOString(), createdAt: createdAt.toISOString(), handle };
    this.timers.set(id, timer);
    this.events.emit(DOMAIN_EVENTS.TIMER_CREATED, { userId, timer: this.stripTimer(timer) } satisfies TimerEvent);
    return this.stripTimer(timer);
  }

  cancelTimer(userId: string, id: string): boolean {
    const t = this.timers.get(id);
    if (!t || t.userId !== userId) return false;
    clearTimeout(t.handle);
    this.timers.delete(id);
    this.events.emit(DOMAIN_EVENTS.TIMER_CANCELLED, { userId, timer: this.stripTimer(t) } satisfies TimerEvent);
    return true;
  }

  private async blockedByHub(userId: string, device: DeviceDocument, hub: DeviceDocument, on: boolean): Promise<ActionResultView> {
    const key = `${hub.homeId.toString()}:${hub.deviceId}`;
    this.pendingByHub.set(key, [...(this.pendingByHub.get(key) ?? []).filter((p) => p.deviceId !== device.deviceId), { deviceId: device.deviceId, on }]);
    device.status = "error";
    await device.save();
    this.emitDevice(userId, device);
    const diagnosis = `I can't reach the ${this.lower(device.name)} right now because the ${this.lower(hub.name)} is offline. I've put a restart button on screen.`;
    const event: DeviceUnreachableEvent = { userId, device: this.toView(device), hub: this.toView(hub), diagnosis, suggestedAction: "restart_hub" };
    this.events.emit(DOMAIN_EVENTS.DEVICE_UNREACHABLE, event);
    return { ok: false, error: "HUB_OFFLINE", device: this.toView(device), hub: this.toView(hub), message: diagnosis };
  }

  private async findDevice(userId: string, query: string): Promise<{ device?: DeviceDocument; candidates: DeviceDocument[] }> {
    const docs = await this.devices.find({ homeId: await this.activeHomeId(userId) }).exec();
    const q = this.normalize(query);
    const exact = docs.find((d) => this.normalize(d.deviceId) === q || this.normalize(d.name) === q || d.aliases.some((a) => this.normalize(a) === q));
    if (exact) return { device: exact, candidates: [] };
    const scored = docs.map((d) => ({ d, score: this.similarity(q, [d.name, d.deviceId, d.room, ...d.aliases]) })).sort((a, b) => b.score - a.score);
    if (scored[0]?.score >= 0.75) return { device: scored[0].d, candidates: [] };
    return { device: undefined, candidates: scored.filter((s) => s.score > 0.2).slice(0, 2).map((s) => s.d) };
  }

  private async activeHomeId(userId: string): Promise<Types.ObjectId> {
    const user = await this.userDoc(userId);
    if (user.activeHomeId) return user.activeHomeId;
    const first = await this.homes.findOne({ userId: user._id }).sort({ createdAt: 1 }).exec();
    if (!first) throw new NotFoundException("This user has no home yet");
    user.activeHomeId = first._id;
    await user.save();
    return first._id;
  }

  private async userDoc(userId: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException("User not found");
    const user = await this.users.findById(userId).exec();
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private async homeDoc(userId: string, homeId: string): Promise<HomeDocument> {
    if (!Types.ObjectId.isValid(homeId)) throw new NotFoundException("Home not found");
    const home = await this.homes.findOne({ _id: new Types.ObjectId(homeId), userId: new Types.ObjectId(userId) }).exec();
    if (!home) throw new NotFoundException("Home not found");
    return home;
  }

  private async homeView(h: HomeDocument): Promise<HomeView> {
    const [deviceCount, connectedCount] = await Promise.all([this.devices.countDocuments({ homeId: h._id }).exec(), this.connected.countDocuments({ homeId: h._id }).exec()]);
    return { id: h._id.toString(), name: h.name, template: h.template, icon: h.icon, deviceCount, connectedCount, createdAt: h.createdAt! };
  }

  private emitDevice(userId: string, device: DeviceDocument, extra: Partial<DeviceView> = {}) {
    const event: DeviceUpdatedEvent = { userId, device: { ...this.toView(device), ...extra } };
    this.events.emit(DOMAIN_EVENTS.DEVICE_UPDATED, event);
  }

  private userView(user: UserDocument): UserView {
    if (!user.activeHomeId) throw new NotFoundException("This user has no home yet");
    return { id: user._id.toString(), name: user.name, privacyEnabled: user.privacyEnabled, activeHomeId: user.activeHomeId.toString(), createdAt: user.createdAt! };
  }

  private environmentKey(input: string): string {
    const lower = input.toLowerCase();
    const key = lower.replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
    if (ENVIRONMENTS[key]) return key;
    const byLabel = Object.entries(ENVIRONMENTS).find(([, v]) => v.label.toLowerCase() === lower);
    if (byLabel) return byLabel[0];
    if (/studio|loft|office/.test(lower)) return "studio-loft";
    if (/house|cabin|cottage|farm|villa|family/.test(lower)) return "family-house";
    return "modern-apartment";
  }

  private toView(d: DeviceDocument): DeviceView {
    return { id: d.deviceId, name: d.name, room: d.room, type: d.type, status: d.status, isOn: d.isOn, locked: d.locked, temperature: d.temperature, hubId: d.hubId };
  }

  private stripTimer<T extends { handle: NodeJS.Timeout; userId: string }>(t: T): TimerView {
    const { handle: _h, userId: _u, ...rest } = t;
    return rest as unknown as TimerView;
  }

  private notFound(query: string, candidates: DeviceDocument[]): ActionResultView {
    const views = candidates.map((c) => this.toView(c));
    const s = query.trim().replace(/^(the|my|a|an)\s+/i, "");
    const article = /^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`;
    return {
      ok: false,
      error: "DEVICE_NOT_FOUND",
      candidates: views,
      message: views.length ? `I couldn't find ${article}. Did you mean the ${views.map((c) => c.name.toLowerCase()).join(" or the ")}?` : `I couldn't find ${article} in this home.`,
    };
  }

  /** How a device is said out loud: "Front Door Lock" becomes "front door". */
  private lower(name: string) {
    return name.toLowerCase().replace(/ lock$/, "");
  }

  /** ["the lamp", "the fan"] becomes "The lamp and the fan". */
  private spokenList(items: string[]) {
    const list = items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
    return list.charAt(0).toUpperCase() + list.slice(1);
  }

  /** "Lights" are, a "Lamp" is. */
  private be(name: string) {
    return /s$/i.test(name.trim()) && !/(?:ss|us|is)$/i.test(name.trim()) ? "are" : "is";
  }

  private normalize(s: string) {
    return s.toLowerCase().replace(/^(the|my|a|an)\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  private similarity(q: string, names: string[]) {
    const qTokens = new Set(q.split(" ").filter(Boolean));
    let best = 0;
    for (const n of names) {
      const t = new Set(this.normalize(n).split(" ").filter(Boolean));
      if (!t.size || !qTokens.size) continue;
      let overlap = 0;
      for (const w of qTokens) if (t.has(w) || t.has(`${w}s`) || t.has(w.replace(/s$/, ""))) overlap++;
      best = Math.max(best, overlap / Math.max(qTokens.size, t.size));
    }
    return best;
  }
}
