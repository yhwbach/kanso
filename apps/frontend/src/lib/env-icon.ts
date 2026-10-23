/** Deterministic home icon from a name. The same name always draws the same house. */
export function envIconSvg(name: string, { stroke = "currentColor", size = 48 }: { stroke?: string; size?: number } = {}): string {
  let h = 2166136261;
  for (const c of name.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const pick = (n: number) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return h % n;
  };
  const lower = name.toLowerCase();
  const kind = /apartment|flat|condo|studio|loft/.test(lower)
    ? "tower"
    : /office|work/.test(lower)
      ? "office"
      : /cabin|cottage|lake|farm/.test(lower)
        ? "cabin"
        : pick(3) === 0
          ? "tower"
          : "house";
  const floors = kind === "tower" ? 3 + pick(2) : 1 + pick(2);
  const roof = ["gable", "hip", "flat", "round"][kind === "tower" ? 2 : pick(4)];
  const windows = 2 + pick(2);
  const chimney = kind !== "tower" && pick(2) === 0;
  const tree = pick(3) === 0;
  const door = pick(2);
  const base = 54;
  const x0 = kind === "tower" ? 18 : 12;
  const x1 = kind === "tower" ? 46 : 52;
  const fh = kind === "tower" ? 9 : 14;
  const top = base - floors * fh;
  const parts: string[] = [`<path d="M${x0} ${base}V${top}H${x1}V${base}" />`];
  if (roof === "gable") parts.push(`<path d="M${x0 - 4} ${top + 2}L${(x0 + x1) / 2} ${top - 12}L${x1 + 4} ${top + 2}" />`);
  if (roof === "hip") parts.push(`<path d="M${x0 - 3} ${top}L${x0 + 8} ${top - 9}H${x1 - 8}L${x1 + 3} ${top}" />`);
  if (roof === "flat") parts.push(`<path d="M${x0 - 3} ${top}H${x1 + 3}" />`);
  if (roof === "round") parts.push(`<path d="M${x0} ${top}A${(x1 - x0) / 2} ${(x1 - x0) / 2} 0 0 1 ${x1} ${top}" />`);
  if (chimney) parts.push(`<path d="M${x1 - 10} ${top - 2}V${top - 10}H${x1 - 5}V${top - 5}" />`);
  for (let f = 0; f < floors; f++) {
    const y = top + f * fh + fh / 2;
    const span = x1 - x0 - 8;
    for (let c = 0; c < windows; c++) {
      const x = x0 + 4 + (span / windows) * c + span / windows / 2;
      if (f === floors - 1 && c === door) parts.push(`<path d="M${x - 3} ${base}V${y - 3}H${x + 3}V${base}" />`);
      else parts.push(`<rect x="${x - 3}" y="${y - 3}" width="6" height="6" rx="1" />`);
    }
  }
  if (tree) parts.push(`<path d="M${x1 + 7} ${base}V${base - 7}M${x1 + 7} ${base - 7}a4 4 0 1 1 0-8a4 4 0 1 1 0 8" />`);
  parts.push(`<path d="M6 ${base}H58" />`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${parts.join("")}</svg>`;
}

export function envIconDataUri(name: string, stroke: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(envIconSvg(name, { stroke }))}`;
}
