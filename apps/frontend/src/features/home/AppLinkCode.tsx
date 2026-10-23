import { useState } from "react";
import { createLinkCode } from "@/api/generated/oauth/oauth";
import type { LinkCodeView } from "@/api/generated/model";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { errorMessage } from "@/lib/format";

/** The code the owner types on Kanso's consent page when Alexa or another app asks to link. */
export function AppLinkCode() {
  const toast = useStore((s) => s.toast);
  const [linkCode, setLinkCode] = useState<LinkCodeView | null>(null);
  const [loading, setLoading] = useState(false);

  const show = async () => {
    setLoading(true);
    try {
      setLinkCode(await createLinkCode());
    } catch (err) {
      toast("Couldn't make a link code", errorMessage(err), "bad");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="border-t border-dashed border-line2 p-5 sm:p-7">
      <span className="label">Linking an app</span>
      <p className="mt-2 text-[14px] text-ink2">When Alexa or another app asks for a link code, enter the one shown here.</p>
      {linkCode ? (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="display text-[44px] leading-none tracking-[0.12em]" aria-label={`Link code ${linkCode.code.split("").join(" ")}`}>
              {linkCode.code.slice(0, 3)} {linkCode.code.slice(3)}
            </p>
            <p className="mt-2 text-[12px] text-ink3">Works once, for the next 10 minutes.</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => void show()} disabled={loading}>
            New code
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ink" className="mt-4" onClick={() => void show()} disabled={loading}>
          {loading ? "Getting a code" : "Show link code"}
        </Button>
      )}
    </section>
  );
}
