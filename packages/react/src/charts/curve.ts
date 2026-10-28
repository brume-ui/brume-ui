/** SVG path builders for lines (pure). */

export type Point = [number, number];

/** Monotone cubic (Fritsch–Carlson) through `pts`: smooth, but never beyond the data. */
export function monotonePath(pts: readonly Point[]): string {
  const n = pts.length;
  if (n === 0) return '';
  const [x0, y0] = pts[0] as Point;
  if (n === 1) return `M${x0},${y0}`;
  if (n === 2) return `M${x0},${y0}L${pts[1]?.[0]},${pts[1]?.[1]}`;
  const dx: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i] as Point;
    const b = pts[i + 1] as Point;
    dx.push(b[0] - a[0]);
    s.push(dx[i] === 0 ? 0 : (b[1] - a[1]) / (dx[i] as number));
  }
  const m: number[] = [s[0] as number];
  for (let i = 1; i < n - 1; i++) {
    const prev = s[i - 1] as number;
    const next = s[i] as number;
    m.push(prev * next <= 0 ? 0 : (prev + next) / 2);
  }
  m.push(s[n - 2] as number);
  for (let i = 0; i < n - 1; i++) {
    const si = s[i] as number;
    if (si === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = (m[i] as number) / si;
    const b = (m[i + 1] as number) / si;
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      m[i] = k * a * si;
      m[i + 1] = k * b * si;
    }
  }
  let d = `M${x0},${y0}`;
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = pts[i] as Point;
    const [xb, yb] = pts[i + 1] as Point;
    const h = (dx[i] as number) / 3;
    d += `C${xa + h},${ya + (m[i] as number) * h} ${xb - h},${yb - (m[i + 1] as number) * h} ${xb},${yb}`;
  }
  return d;
}

export function linePath(pts: readonly Point[]): string {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join('');
}

/** Splits a series into runs of consecutive non-null points (a missing value is a gap). */
export function segments(points: ReadonlyArray<Point | null>): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const p of points) {
    if (p) run.push(p);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}
