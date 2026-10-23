import { useMemo } from "react";
import { avatarSvg } from "@/lib/avatar";

/** A square the same size as the other header controls, with the glyph drawn at two thirds of it. */
export function Avatar({ name, size = 36, className = "", title }: { name: string; size?: number; className?: string; title?: string }) {
  const glyph = Math.round(size * 0.66);
  const svg = useMemo(() => avatarSvg(name, { size: glyph }), [name, glyph]);
  return (
    <span
      title={title}
      className={`grid shrink-0 place-items-center border border-line bg-surface text-ink ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
