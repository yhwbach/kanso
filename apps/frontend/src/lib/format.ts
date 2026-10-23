export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Up late,";
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

export function formatCountdown(endsAt: string, now = Date.now()) {
  const left = Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}:${String(s).padStart(2, "0")}`;
}

export function relativeTime(iso: string | Date, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.round(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ms(value: number | null | undefined) {
  return value == null ? "n/a" : `${Math.round(value)} ms`;
}

/** "20:40" as "8:40 PM". */
export function clockTime(daily: string) {
  const [h, m] = daily.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function humanize(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Splits text on redaction placeholders like [PHONE_1]. Each part is keyed by where it starts in the text. */
export function splitRedactions(text: string): { key: number; text: string; redacted: boolean }[] {
  const parts: { key: number; text: string; redacted: boolean }[] = [];
  let offset = 0;
  for (const part of text.split(/(\[[A-Z_]+_\d+\])/g)) {
    if (part) parts.push({ key: offset, text: part, redacted: /^\[[A-Z_]+_\d+\]$/.test(part) });
    offset += part.length;
  }
  return parts;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
