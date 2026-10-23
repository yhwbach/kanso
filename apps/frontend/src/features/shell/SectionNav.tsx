import { useEffect, useRef, useState } from "react";
import { House, Menu, ShieldCheck, Wand2, X } from "lucide-react";
import { useStore, type View } from "@/lib/store";

const sections: { id: View; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "automations", label: "Automations", icon: Wand2 },
];

/** One square that opens an upward list. The current section is named beside it. */
export function MenuNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = sections.find((v) => v.id === view)!;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-full min-h-11 items-center gap-3 border border-line2 bg-surface pl-3 pr-4 cursor-pointer"
      >
        <span className={`grid h-7 w-7 place-items-center ${open ? "bg-ink text-bg" : "text-ink"}`}>{open ? <X size={16} /> : <Menu size={16} />}</span>
        <span className="label text-ink">{active.label}</span>
      </button>
      {open && (
        <nav role="menu" aria-label="Sections" className="rise absolute bottom-[calc(100%+8px)] left-0 z-40 w-56 border border-line2 bg-surface">
          {sections.map((v) => (
            <button
              key={v.id}
              role="menuitem"
              onClick={() => {
                setView(v.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${view === v.id ? "bg-ink text-bg" : "text-ink2 hover:bg-bg2 hover:text-ink"}`}
            >
              <v.icon size={16} strokeWidth={1.75} />
              <span className="label text-current">{v.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
