import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { HomeIcon } from "@/components/ui/HomeIcon";
import { Avatar } from "@/components/ui/Avatar";
import { Mark } from "@/components/ui/Wordmark";
import { useStore } from "@/lib/store";
import { errorMessage } from "@/lib/format";

const TEMPLATES = [
  { key: "modern-apartment", label: "Apartment" },
  { key: "family-house", label: "House" },
  { key: "studio-loft", label: "Studio" },
];

export function OnboardingModal() {
  const onboard = useStore((s) => s.onboard);
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState("");
  const [homeName, setHomeName] = useState("");
  const [template, setTemplate] = useState("modern-apartment");
  const [privacy, setPrivacy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const home = homeName.trim() || "My home";

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onboard({ name: name.trim(), homeName: home, template, privacyEnabled: privacy });
    } catch (err) {
      toast("Couldn't get started", errorMessage(err), "bad");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal width="max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="stagger p-5 sm:p-8"
      >
        <div className="flex items-center gap-3 text-ink">
          <Mark size={34} />
          <h1 className="text-[26px] font-bold tracking-[-0.03em]">Welcome.</h1>
        </div>
        <p className="mt-2 text-[14px] text-ink2">Thirty seconds, no account. Nothing here leaves your machine.</p>

        <div className="mt-7 flex items-end gap-4">
          <label className="flex-1">
            <span className="label">Your name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
              maxLength={40}
              className="field mt-2 h-12 w-full px-4 text-[17px] outline-none placeholder:text-ink3"
            />
          </label>
          <Avatar name={name.trim() || "Alex"} size={48} title="Your mark, drawn from your name" />
        </div>

        <div className="mt-5 flex items-end gap-4">
          <label className="flex-1">
            <span className="label">Your home</span>
            <input
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
              placeholder="Modern Apartment"
              maxLength={40}
              className="field mt-2 h-12 w-full px-4 text-[17px] outline-none placeholder:text-ink3"
            />
          </label>
          <div className="tile grid h-12 w-12 place-items-center text-ink">
            <HomeIcon name={home} size={28} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {TEMPLATES.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setTemplate(t.key)}
              className={`tile p-3 text-left text-[14px] font-semibold ${template === t.key ? "on" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="tile mt-5 flex items-center justify-between p-4">
          <div>
            <div className="text-[14px] font-semibold">Keep personal details private</div>
            <div className="text-[12px] text-ink3">Names, numbers and addresses are hidden before anything is saved.</div>
          </div>
          <Toggle checked={privacy} onChange={setPrivacy} label="Keep personal details private" />
        </div>

        <Button type="submit" className="mt-7 w-full" disabled={!name.trim() || submitting}>
          {submitting ? "Setting up" : "Enter Kanso"} <ArrowRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
