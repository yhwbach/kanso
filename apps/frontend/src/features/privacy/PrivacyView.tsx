import { useEffect, useState } from "react";
import { getCommandLog, getTelemetry } from "@/api/generated/privacy/privacy";
import type { CommandLogView, TelemetrySummary } from "@/api/generated/model";
import { useStore } from "@/lib/store";
import { humanize, relativeTime } from "@/lib/format";
import { useCountUp } from "@/lib/motion";
import { RedactedText } from "@/components/ui/RedactedText";

export function PrivacyView() {
  const user = useStore((s) => s.user)!;
  const [log, setLog] = useState<CommandLogView[]>([]);
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);

  useEffect(() => {
    void getCommandLog({ userId: user.id, limit: 40 }).then(setLog);
    void getTelemetry({ userId: user.id }).then(setSummary);
  }, [user.id]);

  const actions = Object.entries(summary?.byAction ?? {})
    .filter(([k]) => k !== "unknown")
    .toSorted((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...actions.map(([, v]) => v));

  return (
    <div>
      <section className="stagger pt-8 pb-8 sm:pt-14 sm:pb-10">
        <h1 className="display text-[clamp(36px,7vw,72px)]">What left the house.</h1>
        <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ink2 sm:mt-5 sm:text-[17px]">
          Everything you say is understood here. The only thing that ever goes out is a count of what kind of thing you asked for, and only when you ask Kanso
          to build something new.
        </p>
      </section>

      <div className="grid grid-cols-12 gap-3 sm:gap-6">
        <Stat label="Things you asked" value={summary?.commands ?? 0} />
        <Stat label="Details kept private" value={summary?.piiRedacted ?? 0} />
        <Stat label="Handled at home" value={summary?.localOnlyCount ?? 0} accent />
        <Stat label="Needed the cloud" value={summary?.cloudEgressCount ?? 0} />

        <section className="panel col-span-12 p-4 sm:p-6 lg:col-span-7">
          <span className="label">Recent</span>
          <div className="mt-3 divide-y divide-line">
            {log.length === 0 && <p className="py-6 text-[14px] text-ink3">Nothing yet.</p>}
            {log.map((entry) => (
              <div key={entry.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[16px] font-medium leading-snug">
                    <RedactedText text={entry.sanitizedText} />
                  </p>
                  <span className="label shrink-0">{relativeTime(entry.timestamp)}</span>
                </div>
                <p className="mt-1 text-[14px] text-ink2">{entry.reply}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`label ${entry.cloudEgress ? "text-accent" : "text-ink3"}`}>
                    {entry.cloudEgress ? "Built with the cloud" : "Stayed home"}
                  </span>
                  {entry.piiDetected && (
                    <span className="label text-bad">
                      {entry.piiLabels.length} detail{entry.piiLabels.length === 1 ? "" : "s"} hidden
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel col-span-12 p-4 sm:p-6 lg:col-span-5">
          <span className="label">What the outside world sees</span>
          <p className="mt-2 text-[13px] text-ink3">Only counts by kind of request. No names, no words, no rooms.</p>
          <div className="mt-5 flex flex-col gap-3" role="img" aria-label="Requests by kind">
            {actions.length === 0 && <p className="text-[14px] text-ink3">Nothing yet.</p>}
            {actions.map(([action, count]) => (
              <div key={action} className="grid grid-cols-[130px_1fr_32px] items-center gap-3 text-[13px]" title={`${humanize(action)}: ${count}`}>
                <span className="truncate text-ink2">{humanize(action)}</span>
                <span className="h-2.5 w-full overflow-hidden rounded-r-[4px] bg-line/60">
                  <span className="block h-full rounded-r-[4px] bg-ink transition-[width] duration-500" style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <span className="numerals text-right text-[14px]">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <span className="label">Typical speed</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="numerals text-[44px] leading-none">{summary?.avgLatency.total ?? 0}</span>
              <span className="text-[13px] text-ink3">ms from your words to the lights</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  const shown = useCountUp(value);
  return (
    <section className={`panel col-span-6 p-4 sm:p-5 md:col-span-3 ${accent ? "border-accent" : ""}`}>
      <span className="label">{label}</span>
      <div className={`numerals mt-3 text-[clamp(28px,4vw,44px)] leading-none ${accent ? "text-accent" : ""}`}>{shown}</div>
    </section>
  );
}
