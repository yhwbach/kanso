import { useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronUp, Clock, Play, Save, Trash2, Wand2 } from "lucide-react";
import { deleteToolFile, getToolSource, runTool, saveToolSource, scaffoldTool } from "@/api/generated/tools/tools";
import type { ToolView } from "@/api/generated/model";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { clockTime, humanize, errorMessage } from "@/lib/format";
import { alertsState, enableAlerts, type AlertsState } from "@/lib/system-alerts";

export function AutomationsView() {
  const tools = useStore((s) => s.tools);
  const refresh = useStore((s) => s.refreshTools);
  const toast = useStore((s) => s.toast);
  const user = useStore((s) => s.user)!;
  const lastScaffold = useStore((s) => s.lastScaffold);
  const extensions = useStore((s) => s.toolsOverview?.extensions);
  const [alerts, setAlerts] = useState<AlertsState>(alertsState);
  const [intent, setIntent] = useState("");
  const [building, setBuilding] = useState(false);
  const [open, setOpen] = useState<string | null>(lastScaffold?.toolName ?? null);

  const mine = tools.filter((t) => t.source === "extension");
  const builtIn = tools.filter((t) => t.source === "core");

  const build = async () => {
    if (intent.trim().length < 8) return;
    setBuilding(true);
    void enableAlerts().then(setAlerts);
    try {
      const r = await scaffoldTool({ userId: user.id, intent: intent.trim() });
      setIntent("");
      // The tool.scaffolded event announces it, for builds from this page and by voice alike.
      setOpen(r.tool.name);
    } catch (err) {
      toast("Couldn't build that", errorMessage(err), "bad");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div>
      <section className="stagger pt-8 pb-8 sm:pt-14 sm:pb-10">
        <h1 className="display text-[clamp(36px,7vw,72px)]">Automations.</h1>
        <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ink2 sm:mt-5 sm:text-[17px]">
          Describe what you want in a sentence. Kanso builds it and keeps it ready. You never have to look at the code, but it is here if you're curious.
        </p>
      </section>

      <section className="panel p-6">
        <span className="label">Make a new one</span>
        <form
          className="mt-3 flex flex-col gap-3 md:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!building && intent.trim().length >= 8) void build();
          }}
        >
          <input
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="Check my front door lock and alert me if it is unlocked after 10 PM"
            className="field h-12 flex-1 px-4 text-[15px] outline-none placeholder:text-ink3"
          />
          <Button type="submit" className="h-12 shrink-0" disabled={building || intent.trim().length < 8}>
            <Wand2 size={14} /> {building ? "Building" : "Build it"}
          </Button>
        </form>
        {alerts === "default" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line2 pt-4">
            <p className="text-[13px] text-ink2">Get a heads-up from your automations, even when Kanso isn't open.</p>
            <Button variant="ghost" onClick={() => void enableAlerts().then(setAlerts)}>
              <Bell size={14} /> Turn on alerts
            </Button>
          </div>
        )}
        {alerts === "denied" && (
          <p className="mt-4 border-t border-dashed border-line2 pt-4 text-[13px] text-ink3">Alerts are turned off for Kanso in this browser's settings.</p>
        )}
      </section>

      <section className="mt-6">
        <span className="label">Yours</span>
        <div className="mt-3 grid gap-3">
          {mine.length === 0 && (
            <p className="panel p-6 text-[14px] text-ink3">Nothing yet. Ask for one above, or just say "create a tool that..." on the home screen.</p>
          )}
          {mine.map((t) => (
            <AutomationRow
              key={t.name}
              tool={t}
              daily={extensions?.find((e) => e.fileName === t.fileName)?.daily}
              userId={user.id}
              open={open === t.name}
              onToggle={() => setOpen(open === t.name ? null : t.name)}
              onChanged={() => void refresh()}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <span className="label">Built in</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {builtIn.map((t) => (
            <span key={t.name} className="chip cursor-default" title={t.description}>
              {humanize(t.name)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function AutomationRow({
  tool,
  daily,
  userId,
  open,
  onToggle,
  onChanged,
}: {
  tool: ToolView;
  daily: string | undefined;
  userId: string;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const toast = useStore((s) => s.toast);
  const [code, setCode] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!open || code !== null) return;
    void getToolSource(tool.name).then((s) => {
      setCode(s.code ?? "");
      setDraft(s.code ?? "");
    });
  }, [open, code, tool.name]);

  const run = async () => {
    try {
      const r = await runTool(tool.name, { userId, input: {} });
      const message = (r.result as { message?: string })?.message;
      setResult(message ?? JSON.stringify(r.result));
    } catch (err) {
      setResult(errorMessage(err));
    }
  };

  const save = async () => {
    if (!tool.fileName) return;
    setSaving(true);
    try {
      await saveToolSource(tool.fileName, { code: draft });
      setCode(draft);
      toast("Saved and live", undefined, "good");
      onChanged();
    } catch (err) {
      toast("That version didn't load", errorMessage(err), "bad");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!tool.fileName) return;
    await deleteToolFile(tool.fileName);
    toast("Removed");
    onChanged();
  };

  return (
    <div className="panel overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-5 text-left cursor-pointer">
        <div>
          <div className="text-[17px] font-bold tracking-[-0.02em]">{humanize(tool.name)}</div>
          <div className="mt-0.5 text-[13px] text-ink2">{tool.description}</div>
          {daily && (
            <div className="label mt-2 flex items-center gap-1.5 text-ink3">
              <Clock size={12} /> Every day at {clockTime(daily)}
            </div>
          )}
        </div>
        {open ? <ChevronUp size={18} className="shrink-0 text-ink3" /> : <ChevronDown size={18} className="shrink-0 text-ink3" />}
      </button>
      {open && (
        <div className="border-t border-line px-5 pb-5 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ink" onClick={() => void run()}>
              <Play size={14} /> Try it now
            </Button>
            <Button variant="ghost" onClick={() => setShowCode((v) => !v)}>
              {showCode ? "Hide the code" : "Show the code"}
            </Button>
            <Button variant="ghost" onClick={() => void remove()} aria-label="Remove">
              <Trash2 size={14} /> Remove
            </Button>
          </div>
          {result && <p className="mt-4 text-[15px] font-medium">{result}</p>}
          {showCode && (
            <div className="mt-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                rows={18}
                className="field w-full resize-y p-4 font-label text-[12.5px] leading-relaxed outline-none"
              />
              <div className="mt-2 flex justify-end">
                <Button onClick={() => void save()} disabled={saving || draft === code}>
                  <Save size={14} /> {saving ? "Saving" : "Save and apply"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
