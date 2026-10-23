import { useMemo, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { HomeIcon } from "@/components/ui/HomeIcon";
import { useStore } from "@/lib/store";
import { errorMessage } from "@/lib/format";
import { AppLinkCode } from "@/features/home/AppLinkCode";

const TEMPLATES = [
  { key: "modern-apartment", label: "Apartment" },
  { key: "family-house", label: "House" },
  { key: "studio-loft", label: "Studio" },
];

const KINDS = [
  { kind: "echo-show", label: "Echo Show" },
  { kind: "echo-dot", label: "Echo Dot" },
  { kind: "echo-studio", label: "Echo Studio" },
  { kind: "echo-hub", label: "Echo Hub" },
  { kind: "fire-tv", label: "Fire TV" },
  { kind: "hue-bridge", label: "Hue Bridge" },
  { kind: "other", label: "Something else" },
] as const;

function readSvg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("That file is not an SVG"))));
    reader.addEventListener("error", () => reject(new Error("Could not read the file")));
    reader.readAsText(file);
  });
}

export function NewHomeModal() {
  const addHome = useStore((s) => s.addHome);
  const openModal = useStore((s) => s.openModal);
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  const [icon, setIcon] = useState("");
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => name.trim() || "New home", [name]);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addHome({ name: name.trim(), template: template || undefined, icon: icon || undefined });
    } catch (err) {
      toast("Couldn't add that home", errorMessage(err), "bad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={() => openModal(null)} width="max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="p-5 sm:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="label">New home</span>
            <h2 className="mt-1 text-[26px] font-bold tracking-[-0.03em]">Give it a name.</h2>
          </div>
          <button type="button" onClick={() => openModal(null)} aria-label="Close" className="text-ink3 hover:text-ink cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="tile grid h-20 w-20 shrink-0 place-items-center text-ink">
            <HomeIcon name={preview} icon={icon} size={48} />
          </div>
          <div className="flex-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lake Cabin"
              maxLength={40}
              className="field h-12 w-full px-4 text-[16px] outline-none placeholder:text-ink3"
            />
            <p className="mt-2 text-[12px] text-ink3">The icon draws itself from the name. Or bring your own.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <label className="chip dashed cursor-pointer">
            <Upload size={14} /> {icon ? "Replace icon" : "Use my own SVG"}
            <input
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={async (e) => e.target.files?.[0] && setIcon(await readSvg(e.target.files[0]))}
            />
          </label>
          {icon && (
            <button type="button" onClick={() => setIcon("")} className="chip">
              Back to the generated one
            </button>
          )}
        </div>

        <div className="mt-6">
          <span className="label">Start with</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                type="button"
                key={t.key}
                onClick={() => setTemplate(t.key === template ? "" : t.key)}
                className={`tile p-3 text-left text-[14px] font-semibold ${template === t.key ? "on" : ""}`}
              >
                {t.label}
                <div className="text-[12px] font-normal text-ink3">{template === t.key ? "Selected" : "Typical devices"}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink3">Leave it blank and Kanso guesses from the name.</p>
        </div>

        <Button type="submit" className="mt-7 w-full" disabled={!name.trim() || saving}>
          {saving ? "Setting up" : "Add home"}
        </Button>
      </form>
    </Modal>
  );
}

export function EditHomeModal() {
  const activeHome = useStore((s) => s.activeHome)!;
  const homes = useStore((s) => s.homes);
  const editHome = useStore((s) => s.editHome);
  const removeHome = useStore((s) => s.removeHome);
  const openModal = useStore((s) => s.openModal);
  const [name, setName] = useState(activeHome.name);
  const [icon, setIcon] = useState(activeHome.icon ?? "");
  return (
    <Modal onClose={() => openModal(null)} width="max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void editHome({ name: name.trim() || undefined, icon });
        }}
        className="p-5 sm:p-7"
      >
        <span className="label">This home</span>
        <div className="mt-4 flex items-center gap-4">
          <div className="tile grid h-20 w-20 shrink-0 place-items-center text-ink">
            <HomeIcon name={name || activeHome.name} icon={icon} size={48} />
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="field h-12 flex-1 px-4 text-[16px] outline-none" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="chip dashed cursor-pointer">
            <Upload size={14} /> Use my own SVG
            <input
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={async (e) => e.target.files?.[0] && setIcon(await readSvg(e.target.files[0]))}
            />
          </label>
          {icon && (
            <button type="button" onClick={() => setIcon("")} className="chip">
              Back to the generated one
            </button>
          )}
        </div>
        <div className="mt-7 flex gap-2">
          <Button type="submit" className="flex-1">
            Save
          </Button>
          {homes.length > 1 && (
            <Button type="button" variant="ghost" onClick={() => void removeHome(activeHome.id)}>
              Remove home
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function ConnectDeviceModal() {
  const activeHome = useStore((s) => s.activeHome)!;
  const linkDevice = useStore((s) => s.linkDevice);
  const openModal = useStore((s) => s.openModal);
  const toast = useStore((s) => s.toast);
  const [kind, setKind] = useState<(typeof KINDS)[number]["kind"]>("echo-show");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const label = KINDS.find((k) => k.kind === kind)!.label;

  const submit = async () => {
    setSaving(true);
    try {
      await linkDevice({ kind, name: name.trim() || `${room.trim() || activeHome.name} ${label}`, room: room.trim() || undefined });
    } catch (err) {
      toast("Couldn't link that device", errorMessage(err), "bad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={() => openModal(null)} width="max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="p-5 sm:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="label">Link to {activeHome.name}</span>
            <h2 className="mt-1 text-[26px] font-bold tracking-[-0.03em]">What are you adding?</h2>
          </div>
          <button type="button" onClick={() => openModal(null)} aria-label="Close" className="text-ink3 hover:text-ink cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button type="button" key={k.kind} onClick={() => setKind(k.kind)} className={`chip ${kind === k.kind ? "active" : ""}`}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label>
            <span className="label">Room</span>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Kitchen"
              maxLength={40}
              className="field mt-2 h-12 w-full px-4 text-[15px] outline-none placeholder:text-ink3"
            />
          </label>
          <label>
            <span className="label">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${room.trim() || activeHome.name} ${label}`}
              maxLength={40}
              className="field mt-2 h-12 w-full px-4 text-[15px] outline-none placeholder:text-ink3"
            />
          </label>
        </div>
        <p className="mt-3 text-[12px] text-ink3">Kanso will answer on this device through Alexa once it is linked to your account.</p>
        <Button type="submit" className="mt-7 w-full" disabled={saving}>
          {saving ? "Linking" : "Link device"}
        </Button>
      </form>
      <AppLinkCode />
    </Modal>
  );
}
