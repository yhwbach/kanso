export function describeDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = s / 60;
  if (m < 60) return Number.isInteger(m) ? `${m} minute${m === 1 ? "" : "s"}` : `${m.toFixed(1)} minutes`;
  const h = m / 60;
  return Number.isInteger(h) ? `${h} hour${h === 1 ? "" : "s"}` : `${h.toFixed(1)} hours`;
}
