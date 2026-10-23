import { create } from "zustand";
import {
  activateHome,
  connectDevice,
  createHome,
  deleteHome,
  disconnectDevice,
  getHome,
  onboard as onboardRequest,
  restartHub,
  updateHome,
} from "@/api/generated/home/home";
import { sendTextCommand } from "@/api/generated/commands/commands";
import { listTools } from "@/api/generated/tools/tools";
import { getLocalAiStatus } from "@/api/generated/local-ai/local-ai";
import { getTavusStatus } from "@/api/generated/tavus/tavus";
import { sendVoiceCommand } from "@/api/voice";
import { ApiError } from "@/api/http";
import { clockTime, errorMessage, humanize } from "@/lib/format";
import { showSystemAlert } from "@/lib/system-alerts";
import type { RealtimeEvent } from "@/lib/events";
import type {
  CommandResult,
  ConnectDeviceRequest,
  ConnectedDeviceView,
  DeviceStateView,
  HomeSnapshot,
  HomeView,
  LocalAiStatusView,
  OnboardRequest,
  TavusStatusView,
  TimerView,
  ToolView,
  ToolsOverview,
  UserView,
} from "@/api/generated/model";

export type View = "home" | "privacy" | "automations";

export interface Diagnostic {
  device: DeviceStateView;
  hub: DeviceStateView;
  diagnosis: string;
  state: "offline" | "restarting" | "online";
  message?: string;
}

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: "neutral" | "good" | "bad";
}

export interface Scaffold {
  toolName: string;
  code: string;
  engine: string;
  intent?: string;
  fileName?: string;
}

const USER_KEY = "kanso.userId";

interface State {
  booted: boolean;
  user: UserView | null;
  homes: HomeView[];
  activeHome: HomeView | null;
  devices: DeviceStateView[];
  connected: ConnectedDeviceView[];
  timers: TimerView[];
  tools: ToolView[];
  toolsOverview: ToolsOverview | null;
  localAi: LocalAiStatusView | null;
  tavus: TavusStatusView | null;
  view: View;
  lastCommand: CommandResult | null;
  busy: boolean;
  diagnostic: Diagnostic | null;
  lastScaffold: Scaffold | null;
  toasts: Toast[];
  browserSpeechOnly: boolean;
  modal: "new-home" | "connect-device" | "edit-home" | null;

  boot: () => Promise<void>;
  onboard: (input: OnboardRequest) => Promise<void>;
  signOut: () => void;
  setView: (view: View) => void;
  openModal: (modal: State["modal"]) => void;
  applySnapshot: (snapshot: HomeSnapshot) => void;
  refreshTools: () => Promise<void>;
  addHome: (input: { name: string; template?: string; icon?: string }) => Promise<void>;
  editHome: (input: { name?: string; icon?: string }) => Promise<void>;
  removeHome: (homeId: string) => Promise<void>;
  switchHome: (homeId: string) => Promise<void>;
  linkDevice: (input: Omit<ConnectDeviceRequest, "userId">) => Promise<void>;
  unlinkDevice: (connectedId: string) => Promise<void>;
  sendText: (text: string, meta?: { transcribeMs?: number; engine?: string }) => Promise<CommandResult | null>;
  sendAudio: (wav: Blob) => Promise<CommandResult | null>;
  restartHub: (hubId: string) => Promise<void>;
  dismissDiagnostic: () => void;
  toast: (title: string, body?: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  applyEvent: (event: RealtimeEvent) => void;
}

let toastSeq = 1;

export const useStore = create<State>((set, get) => ({
  booted: false,
  user: null,
  homes: [],
  activeHome: null,
  devices: [],
  connected: [],
  timers: [],
  tools: [],
  toolsOverview: null,
  localAi: null,
  tavus: null,
  view: "home",
  lastCommand: null,
  busy: false,
  diagnostic: null,
  lastScaffold: null,
  toasts: [],
  browserSpeechOnly: false,
  modal: null,

  boot: async () => {
    const userId = localStorage.getItem(USER_KEY);
    if (userId) {
      try {
        get().applySnapshot(await getHome(userId));
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    set({ booted: true });
    void get().refreshTools();
    void getLocalAiStatus()
      .then((localAi) => set({ localAi }))
      .catch(() => undefined);
    void getTavusStatus()
      .then((tavus) => set({ tavus }))
      .catch(() => undefined);
  },

  onboard: async (input) => {
    const snapshot = await onboardRequest(input);
    localStorage.setItem(USER_KEY, snapshot.user.id);
    get().applySnapshot(snapshot);
    set({ lastCommand: null, diagnostic: null, view: "home" });
  },

  signOut: () => {
    localStorage.removeItem(USER_KEY);
    set({ user: null, homes: [], activeHome: null, devices: [], connected: [], timers: [], lastCommand: null, diagnostic: null });
  },

  setView: (view) => {
    set({ view });
  },

  openModal: (modal) => {
    set({ modal });
  },

  applySnapshot: (snapshot) => {
    set({
      user: snapshot.user,
      homes: snapshot.homes,
      activeHome: snapshot.activeHome,
      devices: snapshot.devices,
      connected: snapshot.connected,
      timers: snapshot.timers,
    });
  },

  refreshTools: async () => {
    try {
      const overview = await listTools();
      set({ tools: overview.tools, toolsOverview: overview });
    } catch {
      /* backend not up yet */
    }
  },

  addHome: async (input) => {
    const user = get().user;
    if (!user) return;
    const home = await createHome({ userId: user.id, ...input });
    get().applySnapshot(await activateHome(home.id, { userId: user.id }));
    set({ modal: null, diagnostic: null, lastCommand: null });
    get().toast(`${home.name} is ready`, "Say something to try it.", "good");
  },

  editHome: async (input) => {
    const { user, activeHome } = get();
    if (!user || !activeHome) return;
    await updateHome(activeHome.id, { userId: user.id, ...input });
    get().applySnapshot(await getHome(user.id));
    set({ modal: null });
  },

  removeHome: async (homeId) => {
    const user = get().user;
    if (!user) return;
    await deleteHome(homeId, { userId: user.id });
    get().applySnapshot(await getHome(user.id));
    set({ modal: null });
  },

  switchHome: async (homeId) => {
    const user = get().user;
    if (!user || homeId === get().activeHome?.id) return;
    get().applySnapshot(await activateHome(homeId, { userId: user.id }));
    set({ diagnostic: null, lastCommand: null });
  },

  linkDevice: async (input) => {
    const { user, activeHome } = get();
    if (!user || !activeHome) return;
    const device = await connectDevice(activeHome.id, { userId: user.id, ...input });
    set((s) => ({
      connected: [...s.connected, device],
      modal: null,
      homes: s.homes.map((h) => (h.id === activeHome.id ? { ...h, connectedCount: h.connectedCount + 1 } : h)),
    }));
    get().toast(`${device.name} is linked to ${activeHome.name}`, undefined, "good");
  },

  unlinkDevice: async (connectedId) => {
    const { user, activeHome } = get();
    if (!user || !activeHome) return;
    await disconnectDevice(activeHome.id, connectedId, { userId: user.id });
    set((s) => ({ connected: s.connected.filter((c) => c.id !== connectedId) }));
  },

  sendText: async (text, meta) => {
    const user = get().user;
    if (!user || !text.trim()) return null;
    set({ busy: true });
    try {
      const result = await sendTextCommand({ userId: user.id, text: text.trim(), transcribeMs: meta?.transcribeMs, engine: meta?.engine });
      set({ lastCommand: result });
      return result;
    } catch (err) {
      get().toast("That didn't go through", errorMessage(err), "bad");
      return null;
    } finally {
      set({ busy: false });
    }
  },

  sendAudio: async (wav) => {
    const user = get().user;
    if (!user) return null;
    set({ busy: true });
    try {
      const result = await sendVoiceCommand(wav, user.id);
      set({ lastCommand: result });
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        set({ browserSpeechOnly: true });
        get().toast("Listening with the browser for now", "Kanso's own ear is still warming up. Everything else stays on this machine.");
      } else {
        get().toast("I couldn't hear that", errorMessage(err), "bad");
      }
      return null;
    } finally {
      set({ busy: false });
    }
  },

  restartHub: async (hubId) => {
    const user = get().user;
    if (!user) return;
    const current = get().diagnostic;
    if (current) set({ diagnostic: { ...current, state: "restarting" } });
    try {
      const result = await restartHub({ userId: user.id, hubId });
      const d = get().diagnostic;
      if (d) set({ diagnostic: { ...d, state: "online", hub: result.hub, message: result.message } });
      // The blocked command was replayed during the restart, so its reply should say what happened now.
      const last = get().lastCommand;
      if (last && !last.ok) set({ lastCommand: { ...last, ok: true, reply: result.message } });
      window.setTimeout(() => {
        if (get().diagnostic?.state === "online") set({ diagnostic: null });
      }, 3500);
    } catch (err) {
      get().toast("The hub didn't come back", errorMessage(err), "bad");
      const d = get().diagnostic;
      if (d) set({ diagnostic: { ...d, state: "offline" } });
    }
  },

  dismissDiagnostic: () => {
    set({ diagnostic: null });
  },

  toast: (title, body, tone = "neutral") => {
    if (get().toasts.some((t) => t.title === title && t.body === body)) return;
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, title, body, tone }] }));
    window.setTimeout(() => get().dismissToast(id), 5000);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  applyEvent: (event) => {
    switch (event.type) {
      case "device.updated": {
        const device = { ...event.payload, restarting: event.payload.restarting === true };
        set((s) => ({ devices: s.devices.map((d) => (d.id === device.id ? { ...d, ...device } : d)) }));
        const d = get().diagnostic;
        if (d && device.id === d.hub.id) {
          if (device.restarting) set({ diagnostic: { ...d, state: "restarting", hub: device } });
          else if (device.status === "online" && d.state !== "offline") set({ diagnostic: { ...d, state: "online", hub: device } });
        }
        break;
      }
      case "device.unreachable": {
        const { device, hub, diagnosis } = event.payload;
        set({ diagnostic: { device, hub, diagnosis, state: "offline" } });
        break;
      }
      case "timer.created": {
        const timer = event.payload;
        set((s) => ({ timers: [...s.timers.filter((t) => t.id !== timer.id), timer] }));
        break;
      }
      case "timer.finished": {
        const timer = event.payload;
        set((s) => ({ timers: s.timers.filter((t) => t.id !== timer.id) }));
        get().toast(`${timer.label} is done`, undefined, "good");
        break;
      }
      case "timer.cancelled": {
        const timer = event.payload;
        set((s) => ({ timers: s.timers.filter((t) => t.id !== timer.id) }));
        break;
      }
      case "tool.registered":
      case "tool.unregistered":
        void get().refreshTools();
        break;
      case "tool.scaffolded": {
        const e = event.payload;
        set({ lastScaffold: { toolName: e.tool.name, code: e.code, engine: e.engine, intent: e.intent, fileName: e.fileName } });
        get().toast(
          "New automation ready",
          e.daily ? `It runs on its own every day at ${clockTime(e.daily)}.` : "Find it under Automations whenever you want a look.",
          "good",
        );
        void get().refreshTools();
        break;
      }
      case "tool.invalid":
        get().toast("An automation needs fixing", `${humanize(event.payload.fileName.replace(/\.ts$/, ""))} didn't load. Open Automations to see why.`, "bad");
        break;
      case "notification":
        get().toast("Kanso", event.payload.message);
        if (document.hidden) void showSystemAlert(event.payload.message);
        break;
      case "command.handled":
        if (event.payload.source === "pal") get().toast("Kanso said", event.payload.reply);
        break;
      case "tool.invoked":
      case "tavus.webhook":
        break;
    }
  },
}));
