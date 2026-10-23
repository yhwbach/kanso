/** A dot-matrix glyph drawn from a name: 7x7, mirrored left to right, one red cell. */
export function avatarSvg(
  name: string,
  { ink = "currentColor", accent = "var(--accent)", size = 36 }: { ink?: string; accent?: string; size?: number } = {},
): string {
  let h = 2166136261;
  for (const c of name.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return h;
  };
  const n = 7;
  const cells: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x <= Math.floor(n / 2); x++) {
      const on = next() % 100 < 48;
      cells[y][x] = on;
      cells[y][n - 1 - x] = on;
    }
  }
  const ay = 1 + (next() % (n - 2));
  const ax = next() % Math.floor(n / 2);
  const unit = 100 / n;
  const dots: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!cells[y][x]) continue;
      const isAccent = y === ay && (x === ax || x === n - 1 - ax);
      dots.push(
        `<rect x="${(x * unit + 1.5).toFixed(2)}" y="${(y * unit + 1.5).toFixed(2)}" width="${(unit - 3).toFixed(2)}" height="${(unit - 3).toFixed(2)}" rx="1.2" fill="${isAccent ? accent : ink}"/>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${dots.join("")}</svg>`;
}
