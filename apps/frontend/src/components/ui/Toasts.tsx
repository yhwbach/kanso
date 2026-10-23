import { X } from "lucide-react";
import { useStore } from "@/lib/store";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-line relative overflow-hidden pointer-events-auto slide-in-right rounded-[var(--radius)] border bg-surface px-4 py-3 ${t.tone === "bad" ? "border-bad text-bad" : t.tone === "good" ? "border-accent text-ink" : "border-line text-ink"}`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-[12px] text-ink2">{t.body}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="cursor-pointer text-ink3 hover:text-ink" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
