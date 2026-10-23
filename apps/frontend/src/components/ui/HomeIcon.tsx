import { useMemo } from "react";
import { envIconSvg } from "@/lib/env-icon";

/** Draws a home's own icon when it has one, otherwise a generated one from its name. */
export function HomeIcon({ name, icon, size = 20, className = "" }: { name: string; icon?: string | null; size?: number; className?: string }) {
  const svg = useMemo(() => icon?.trim() || envIconSvg(name, { size }), [name, icon, size]);
  return (
    <span
      className={`inline-flex shrink-0 [&>svg]:h-[1em] [&>svg]:w-[1em] ${className}`}
      style={{ fontSize: size, color: "currentColor" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
