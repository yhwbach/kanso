import { Injectable, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { z } from "zod";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";
import { DOMAIN_EVENTS, type NotificationEvent } from "@/platform/events/domain-events";
import { HomeService } from "@/home/services/home.service";
import { describeDuration } from "@/home/duration";

@Injectable()
export class HomeTools implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly home: HomeService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    const home = this.home;
    this.registry.provideHomeApi((userId) => ({
      listDevices: () => home.listDevices(userId),
      devices: async (type) => (await home.listDevices(userId)).filter((d) => d.type === type),
      find: async (q) => (await home.status(userId, q)).device,
      status: (q) => home.status(userId, q),
      setPower: (q, on) => home.setPower(userId, q, on),
      setLock: (q, locked) => home.setLock(userId, q, locked),
      setTemperature: (v) => home.setTemperature(userId, v),
      createTimer: (ms, label) => home.createTimer(userId, ms, label),
      notify: (message) => this.events.emit(DOMAIN_EVENTS.NOTIFICATION, { userId, message } satisfies NotificationEvent),
      now: () => new Date(),
    }));

    this.registry.register({
      name: "list_homes",
      description: "List the user's homes and which one is active. Commands apply to the active home.",
      inputSchema: z.object({}),
      source: "core",
      execute: async (_input, ctx) => {
        const snapshot = await home.snapshot(ctx.userId);
        return { active: snapshot.activeHome.name, homes: snapshot.homes.map((h) => ({ id: h.id, name: h.name, devices: h.deviceCount })) };
      },
    });

    this.registry.register({
      name: "switch_home",
      description: "Make another of the user's homes the active one, by name.",
      inputSchema: z.object({ name: z.string() }),
      source: "core",
      execute: async (input, ctx) => {
        const homes = await home.listHomes(ctx.userId);
        const q = String(input.name).toLowerCase();
        const match = homes.find((h) => h.name.toLowerCase() === q) ?? homes.find((h) => h.name.toLowerCase().includes(q));
        if (!match) return { ok: false, message: `I don't see a home called ${input.name}.` };
        await home.setActiveHome(ctx.userId, match.id);
        return { ok: true, message: `Switched to ${match.name}.` };
      },
    });

    this.registry.register({
      name: "list_devices",
      description: "List every smart home device in the user's home with its current state (on/off, locked, temperature, online/offline).",
      inputSchema: z.object({}),
      source: "core",
      execute: async (_input, ctx) => ({ devices: await home.listDevices(ctx.userId) }),
    });

    this.registry.register({
      name: "control_device",
      description:
        "Turn a device on or off, or lock/unlock a lock. Use the device name the user said, such as 'living room lights' or 'front door'. If the result has error HUB_OFFLINE, show a visual diagnostic card with a restart option instead of explaining it.",
      inputSchema: z.object({
        device: z.string().describe("Device name as spoken, such as 'backyard lights'"),
        action: z.enum(["on", "off", "lock", "unlock", "toggle"]),
      }),
      source: "core",
      execute: async (input, ctx) => {
        const device = String(input.device);
        const action = String(input.action);
        if (action === "lock" || action === "unlock") return home.setLock(ctx.userId, device, action === "lock");
        if (action === "toggle") {
          const s = await home.status(ctx.userId, device);
          if (!s.ok || !s.device) return s;
          return home.setPower(ctx.userId, device, !s.device.isOn);
        }
        return home.setPower(ctx.userId, device, action === "on");
      },
    });

    this.registry.register({
      name: "device_status",
      description: "Check whether a device is on/off, locked/unlocked, or online. The message can be spoken verbatim.",
      inputSchema: z.object({ device: z.string() }),
      source: "core",
      execute: async (input, ctx) => home.status(ctx.userId, String(input.device)),
    });

    this.registry.register({
      name: "set_timer",
      description: "Start a countdown timer.",
      inputSchema: z.object({
        minutes: z.number().min(0).max(24 * 60).default(0),
        seconds: z.number().min(0).max(59).default(0),
        label: z.string().max(40).optional(),
      }),
      source: "core",
      execute: async (input, ctx) => {
        const ms = Math.max(1000, Number(input.minutes ?? 0) * 60_000 + Number(input.seconds ?? 0) * 1000);
        const timer = home.createTimer(ctx.userId, ms, (input.label as string) || "Timer");
        return { ok: true, timer, message: `Timer set for ${describeDuration(ms)}.` };
      },
    });

    this.registry.register({
      name: "set_temperature",
      description: "Set the thermostat target temperature in Fahrenheit.",
      inputSchema: z.object({ temperature: z.number().min(50).max(90) }),
      source: "core",
      execute: async (input, ctx) => home.setTemperature(ctx.userId, Number(input.temperature)),
    });

    this.registry.register({
      name: "diagnose_device",
      description:
        "Explain why a device is not working. Returns the hub it depends on and a suggested fix. When healthy is false, show a visual alert card titled with the hub name and a 'Restart hub' option rather than describing it verbally.",
      inputSchema: z.object({ device: z.string() }),
      source: "core",
      execute: async (input, ctx) => home.diagnose(ctx.userId, String(input.device)),
    });

    this.registry.register({
      name: "restart_hub",
      description: "Restart a smart home hub that is offline. Takes about one second. Any command that was waiting on the hub is replayed automatically.",
      inputSchema: z.object({ hub: z.string().default("hub") }),
      source: "core",
      execute: async (input, ctx) => home.restartHub(ctx.userId, String(input.hub ?? "hub")),
    });
  }
}
