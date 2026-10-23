import { splitRedactions } from "@/lib/format";

export function RedactedText({ text }: { text: string }) {
  return (
    <>
      {splitRedactions(text).map((p) =>
        p.redacted ? (
          <span key={p.key} className="pii">
            hidden
          </span>
        ) : (
          <span key={p.key}>{p.text}</span>
        ),
      )}
    </>
  );
}
