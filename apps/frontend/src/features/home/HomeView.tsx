import { useEffect, useMemo, useState } from "react";
import { Fan, Lightbulb, Lock, LockOpen, Loader2, Plus, Radio, Thermometer, Video, X } from "lucide-react";
import type { DeviceStateView } from "@/api/generated/model";
import { setDeviceLock, setDevicePower, cancelTimer } from "@/api/generated/home/home";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { firstName, formatCountdown, greetingFor, errorMessage } from "@/lib/format";
import { useReplay } from "@/lib/motion";
import { PalCard, type PalConversation } from "@/features/pal/PalCard";
import { createConversation } from "@/api/generated/tavus/tavus";
import { DiagnosticPanel } from "@/features/home/DiagnosticPanel";
import { RedactedText } from "@/components/ui/RedactedText";

const KIND_LABEL: Record<string, string> = {
  "echo-show": "Echo Show",
  "echo-dot": "Echo Dot",
  "echo-studio": "Echo Studio",
  "echo-hub": "Echo Hub",
  "fire-tv": "Fire TV",
  "hue-bridge": "Hue Bridge",
  other: "Device",
};

export function HomeView() {
  const user = useStore((s) => s.user)!;
  const devices = useStore((s) => s.devices);
  const connected = useStore((s) => s.connected);
  const timers = useStore((s) => s.timers);
  const last = useStore((s) => s.lastCommand);
  const busy = useStore((s) => s.busy);
  const openModal = useStore((s) => s.openModal);
  const unlink = useStore((s) => s.unlinkDevice);
  const tavus = useStore((s) => s.tavus);
  const toast = useStore((s) => s.toast);
  const [pal, setPal] = useState<PalConversation | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const ordered = useMemo(() => devices.toSorted((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name)), [devices]);
  const on = devices.filter((d) => d.isOn && d.type !== "lock" && d.type !== "hub" && d.status === "online").length;
  const offlineHub = devices.find((d) => d.type === "hub" && d.status !== "online");
  const unlocked = devices.filter((d) => d.type === "lock" && !d.locked).length;
  const timer = timers.toSorted((a, b) => a.endsAt.localeCompare(b.endsAt))[0];
  const reveal = useReplay(last?.logId, "stagger", 800);

  const startPal = async () => {
    if (!tavus?.configured) {
      toast("Face to face isn't set up on this install", "Typing and speaking work the same way.");
      return;
    }
    setConnecting(true);
    try {
      const c = await createConversation({ userId: user.id });
      setPal({ id: c.conversation_id, url: c.conversation_url });
    } catch (err) {
      toast("Couldn't start the call", errorMessage(err), "bad");
    } finally {
      setConnecting(false);
    }
  };

  const summary = [
    on ? `${on === 1 ? "One light" : `${on} lights`} on.` : "Everything is off.",
    offlineHub ? `${offlineHub.name} needs a restart.` : unlocked ? `${unlocked === 1 ? "One door" : `${unlocked} doors`} unlocked.` : "All doors locked.",
  ].join(" ");

  return (
    <div>
      <section className="stagger flex flex-wrap items-end justify-between gap-6 pt-8 pb-8 sm:pt-14 sm:pb-10">
        <div>
          <h1 className="display text-[clamp(40px,8vw,84px)]">
            {greetingFor()} {firstName(user.name)}.
          </h1>
          <p className="mt-4 max-w-[520px] text-[15px] leading-relaxed text-ink2 sm:mt-5 sm:text-[17px]">{summary}</p>
        </div>
        <div className="text-left sm:text-right">
          <div className="label">Timer</div>
          <div className={`numerals mt-1 text-[clamp(40px,6vw,64px)] leading-none ${timer ? "text-ink" : "text-ink3"}`}>
            {timer ? formatCountdown(timer.endsAt, now) : "00:00"}
          </div>
          {timer && (
            <button
              onClick={() => void cancelTimer(timer.id, { userId: user.id })}
              className="label mt-2 inline-flex items-center gap-1 text-ink3 hover:text-bad cursor-pointer"
            >
              {timer.label} <X size={12} />
            </button>
          )}
        </div>
      </section>

      <div className="mb-4 lg:hidden">
        <DiagnosticPanel />
      </div>
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        <section className="panel col-span-12 p-4 sm:p-6 lg:col-span-8">
          <div className="flex items-center justify-between">
            <span className="label">Devices</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
            {ordered.map((d) => (
              <DeviceTile key={d.id} device={d} userId={user.id} />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <span className="label">Linked to this home</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {connected.map((c) => (
              <span key={c.id} className="chip group cursor-default">
                <span className="led on" />
                {c.name}
                <span className="text-ink3">{c.room || KIND_LABEL[c.kind]}</span>
                <button
                  onClick={() => void unlink(c.id)}
                  aria-label={`Unlink ${c.name}`}
                  className="ml-1 hidden text-ink3 hover:text-bad group-hover:inline cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button onClick={() => openModal("connect-device")} className="chip dashed">
              <Plus size={14} /> Link a device
            </button>
          </div>
        </section>

        <div className="col-span-12 flex flex-col gap-4 sm:gap-6 lg:col-span-4">
          <div className="hidden lg:block">
            <DiagnosticPanel />
          </div>
          <section className="panel p-4 sm:p-6">
            <span className="label">Now</span>
            {last ? (
              <div className={`mt-3 ${reveal}`}>
                <p className="text-[22px] font-semibold leading-snug tracking-[-0.02em]">{last.reply}</p>
                <p className="mt-2 text-[13px] text-ink3">
                  "
                  <RedactedText text={last.sanitized} />"
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[16px] text-ink2">{busy ? "Listening." : "Say something, or type it below."}</p>
            )}
          </section>

          <section className="panel p-4 sm:p-6">
            <span className="label">Talk</span>
            {pal ? (
              <div className="mt-4">
                <PalCard conversation={pal} onClose={() => setPal(null)} />
              </div>
            ) : (
              <>
                <p className="mt-3 text-[16px] text-ink2">Face to face, when you'd rather not type.</p>
                <Button variant="ghost" className="mt-4" onClick={() => void startPal()} disabled={connecting}>
                  <Video size={14} /> {connecting ? "Connecting" : "Start a conversation"}
                </Button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const icons: Record<DeviceStateView["type"], typeof Lightbulb> = {
  light: Lightbulb,
  lock: Lock,
  thermostat: Thermometer,
  fan: Fan,
  hub: Radio,
  speaker: Radio,
};

function DeviceTile({ device, userId }: { device: DeviceStateView & { restarting?: boolean }; userId: string }) {
  const toast = useStore((s) => s.toast);
  const Icon = device.type === "lock" ? (device.locked ? Lock : LockOpen) : icons[device.type];
  const active = device.type === "lock" ? device.locked : device.type === "hub" ? device.status === "online" : device.isOn;
  const offline = device.status !== "online";
  const pop = useReplay(`${device.isOn}-${device.locked}-${device.status}`, "pop");
  const switchable = device.type !== "hub" && device.type !== "thermostat";

  const toggle = async () => {
    if (!switchable) return;
    try {
      const result =
        device.type === "lock"
          ? await setDeviceLock(device.id, { userId, locked: !device.locked })
          : await setDevicePower(device.id, { userId, on: !device.isOn });
      if (!result.ok && result.error !== "HUB_OFFLINE") toast(result.message, undefined, "bad");
    } catch (err) {
      toast("That didn't work", errorMessage(err), "bad");
    }
  };

  const state = device.restarting
    ? "Restarting"
    : offline
      ? device.status === "error"
        ? "Unreachable"
        : "Offline"
      : device.type === "lock"
        ? device.locked
          ? "Locked"
          : "Unlocked"
        : device.type === "thermostat"
          ? `${device.temperature}°`
          : device.type === "hub"
            ? "Online"
            : device.isOn
              ? "On"
              : "Off";

  return (
    <button
      onClick={toggle}
      disabled={!switchable}
      className={`tile flex min-h-[112px] flex-col justify-between p-4 text-left cursor-pointer disabled:cursor-default ${active && !offline ? "on" : ""} ${offline ? "bad" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className={`led ${offline ? "bad" : active ? "on" : ""}`} />
        {switchable ? (
          <span className={`rocker ${active && !offline ? "on" : ""}`} />
        ) : (
          <span className={`text-ink3 ${pop}`}>{device.restarting ? <Loader2 size={16} className="spin" /> : <Icon size={16} />}</span>
        )}
      </div>
      <div>
        <div className="text-[14px] font-semibold tracking-[-0.01em]">{device.name}</div>
        <div className={`text-[12px] ${offline ? "text-bad" : "text-ink3"}`}>{offline || active || device.type === "thermostat" ? state : device.room}</div>
      </div>
    </button>
  );
}
