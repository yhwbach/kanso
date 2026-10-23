import { CheckCircle2, Loader2, Radio, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";

export function DiagnosticPanel() {
  const diagnostic = useStore((s) => s.diagnostic);
  const restart = useStore((s) => s.restartHub);
  const dismiss = useStore((s) => s.dismissDiagnostic);
  if (!diagnostic) return null;

  const { device, hub, state } = diagnostic;
  const online = state === "online";
  const restarting = state === "restarting";

  return (
    <aside className={`rise panel border-2 p-4 sm:p-5 ${online ? "border-accent" : "border-bad"}`}>
      <div className="flex items-center justify-between">
        <span className={`label ${online ? "text-accent" : "text-bad"}`}>{online ? "Back online" : "Needs attention"}</span>
        <button onClick={dismiss} aria-label="Dismiss" className="text-ink3 hover:text-ink cursor-pointer">
          <X size={14} />
        </button>
      </div>
      <h3 className="mt-2 text-[20px] font-bold tracking-[-0.02em]">{online ? `${hub.name} is back.` : `${hub.name} is offline.`}</h3>
      <p className="mt-1 text-[13px] text-ink2">{online ? (diagnostic.message ?? "Hub restarted.") : `${device.name} can't be reached until it comes back.`}</p>

      <div className="tile mt-4 flex items-center gap-3 p-4">
        <Node
          label={hub.name}
          tone={online ? "on" : restarting ? "busy" : "bad"}
          icon={restarting ? <Loader2 size={18} className="spin" /> : online ? <CheckCircle2 size={18} /> : <Radio size={18} />}
        />
        <div className={`relative h-[2px] flex-1 bg-line ${restarting ? "travel" : ""}`}>
          <div
            className={`absolute inset-y-0 left-0 transition-[width] duration-700 ${online ? "w-full bg-accent" : restarting ? "w-1/2 bg-accent/60" : "w-1/3 bg-bad"}`}
          />
        </div>
        <Node label={device.name} tone={online ? "on" : "muted"} icon={<Lightbulb size={18} />} />
      </div>

      <div className="mt-4">
        {online ? (
          <Button variant="ghost" className="w-full" onClick={dismiss}>
            Done
          </Button>
        ) : (
          <Button className="w-full" onClick={() => void restart(hub.id)} disabled={restarting}>
            {restarting ? "Restarting" : "Restart hub"}
          </Button>
        )}
      </div>
    </aside>
  );
}

function Node({ label, tone, icon }: { label: string; tone: "on" | "bad" | "busy" | "muted"; icon: React.ReactNode }) {
  return (
    <div className="flex w-[104px] flex-col items-center gap-2 text-center">
      <span
        className={`grid h-11 w-11 place-items-center rounded-full border ${tone === "on" ? "border-accent text-accent" : tone === "bad" ? "border-bad text-bad" : tone === "busy" ? "border-line2 text-ink2" : "border-line text-ink3"}`}
      >
        {icon}
      </span>
      <span className="text-[11px] font-semibold leading-tight text-ink2">{label}</span>
    </div>
  );
}
