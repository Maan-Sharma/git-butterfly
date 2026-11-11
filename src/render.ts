/**
 * Procedural pixel-art renderer: egg, caterpillar, cocoon and a flying butterfly.
 * Everything is drawn on a tiny RGBA canvas (W x H logical pixels) with hard edges,
 * then scaled up with nearest-neighbour in gif.ts so it stays crisp.
 */
import { wingBands, type Band, type Growth, type Stats } from "./model.js";
import {
  BODY, BODY_LIGHT, BRANCH, BRANCH_LIGHT, CREAM, GOLD, LEAF, LEAF_DARK, LEAF_LIGHT, OUTLINE, mix, tones,
  type RGB,
} from "./palette.js";
import { Canvas, type Pt } from "./raster.js";

export const W = 160;
export const H = 90;
export const FRAMES = 60;
const TAU = Math.PI * 2;

// ----------------------------------------------------------------------------- shapes
function chaikin(pts: Pt[], n = 2): Pt[] {
  for (let it = 0; it < n; it++) {
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    pts = out;
  }
  return pts;
}

// ----------------------------------------------------------------------------- scenery
function leaf(cv: Canvas, x: number, y: number, length: number, width: number, angle: number): void {
  const base: Pt[] = [[0, 0], [0.22, -0.55], [0.6, -1], [1, 0], [0.6, 1], [0.22, 0.55]];
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const pts: Pt[] = chaikin(base, 2).map(([u, v]) => {
    const lx = u * length, ly = v * width;
    return [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
  });
  cv.paint(cv.polyMask(pts), (px, py) => {
    const lx = (px + 0.5 - x) * ca + (py + 0.5 - y) * sa;
    const ly = -(px + 0.5 - x) * sa + (py + 0.5 - y) * ca;
    if (Math.abs(ly) < 0.6 && lx > 0.05 * length && lx < 0.92 * length) return LEAF_LIGHT; // mid-rib
    return ly > 0 ? LEAF_DARK : LEAF;
  });
}

function branch(cv: Canvas, y: number, x0: number, x1: number): void {
  cv.rect(x0, y - 1, x1, y + 2, BRANCH);
  for (let x = x0 + 2; x < x1 - 1; x += 7) {
    cv.put(x, y, BRANCH_LIGHT);
    cv.put(x + 1, y, BRANCH_LIGHT);
  }
}

// ----------------------------------------------------------------------------- egg
function drawEgg(cv: Canvas, g: Growth, bands: Band[], t: number): void {
  const by = H - 16;
  branch(cv, by, 8, W - 8);
  leaf(cv, W / 2 - 38, by - 3, 76, 9, 0);
  leaf(cv, W / 2 + 40, by - 2, 34, 6, -0.9);
  const rx = 4.5 + 2.5 * g.progress, ry = 5.5 + 3.5 * g.progress;
  const wob = t > 0.55 && t < 0.8 ? 1.2 * Math.sin(TAU * 7 * t) : 0;
  const ex = W / 2 + wob, ey = by - 11 - ry + 3;
  cv.ellipse(ex - rx, ey - ry, ex + rx, ey + ry, [255, 241, 208]);
  const hx = ex - rx * 0.45, hy = ey - ry * 0.45;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) cv.put(hx + dx, hy + dy, [255, 255, 255]);
  const spots: Pt[] = [[-0.2, 0.15], [0.35, -0.1], [0.05, 0.55], [-0.45, 0.45]];
  spots.forEach(([sx, sy], i) => {
    const c = bands[i % bands.length][0];
    cv.put(ex + sx * rx, ey + sy * ry, c);
    cv.put(ex + sx * rx + 1, ey + sy * ry, tones(c)[2]);
  });
}

// ----------------------------------------------------------------------------- caterpillar
function drawCaterpillar(cv: Canvas, g: Growth, bands: Band[], t: number): void {
  const n = 4 + Math.round(6 * g.progress);
  const r = 4 + 2.5 * g.progress;
  const by = H - 18;
  branch(cv, by, 8, W - 8);
  leaf(cv, 14, by - 2, 34, 8, -0.5);
  leaf(cv, W - 16, by - 2, 38, 8, Math.PI + 0.55);

  const headX = (tt: number) => W / 2 + (40 * Math.asin(0.92 * Math.sin(TAU * tt))) / Math.asin(0.92);
  const face = headX(t + 0.004) - headX(t - 0.004) >= 0 ? 1 : -1;
  const segs: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const hump = 3.2 * Math.max(0, Math.sin(TAU * 6 * t - i * 0.9));
    segs.push([headX(t - i * 0.03), by - 1 - r - hump]);
  }

  for (let i = n - 1; i >= 0; i--) {
    const [x, y] = segs[i];
    if (i === 0) {
      const rr = r * 1.12;
      cv.ellipse(x - rr, y - rr, x + rr, y + rr, tones(bands[0][0])[1]);
      const ex = x + face * rr * 0.4;
      cv.put(ex, y - rr * 0.2, [255, 255, 255]);
      cv.put(ex + face, y - rr * 0.2, OUTLINE);
      for (const k of [-1, 1]) {
        const ax = x + face * rr * 0.1 + k;
        cv.line([[ax, y - rr], [ax + face * 2 + k, y - rr - 4]], OUTLINE);
        cv.put(ax + face * 2 + k, y - rr - 5, bands[bands.length - 1][0]);
      }
    } else {
      const body: RGB = i % 2 ? [118, 206, 96] : [150, 226, 112];
      cv.ellipse(x - r, y - r, x + r, y + r, body);
      const c = bands[(i - 1) % bands.length][0];
      cv.put(x, y - r * 0.45, c);
      cv.put(x + 1, y - r * 0.45, tones(c)[2]);
      cv.put(x, y - r * 0.45 + 1, tones(c)[0]);
    }
    if (i % 2 === 1) cv.put(x, y + r - 0.5, [250, 170, 70]);
  }
}

// ----------------------------------------------------------------------------- cocoon (chrysalis)
function drawCocoon(cv: Canvas, g: Growth, bands: Band[], t: number): void {
  const ax = W / 2, ay = 4;
  branch(cv, 2, 24, W - 24);
  leaf(cv, 30, 8, 30, 7, 0.45);
  leaf(cv, W - 30, 8, 30, 7, Math.PI - 0.45);
  const length = 20 + 10 * g.progress;
  const wmax = 6 + 3.5 * g.progress;
  const top = 10;
  let theta = 0.2 * Math.sin(TAU * t);
  if (t > 0.55 && t < 0.8) theta += 0.09 * Math.sin(TAU * 8 * t);
  const ct = Math.cos(theta), st = Math.sin(theta);
  const world = (lx: number, ly: number): Pt => [ax + lx * ct - ly * st, ay + lx * st + ly * ct];

  const left: Pt[] = [], right: Pt[] = [];
  for (let k = 0; k <= 16; k++) {
    const v = k / 16;
    const w = wmax * Math.sin(Math.PI * v ** 0.72) ** 0.8;
    left.push(world(-w, top + length * v));
    right.push(world(w, top + length * v));
  }
  cv.line([[ax, ay], world(0, top)], [190, 170, 130]);

  cv.paint(cv.polyMask([...left, ...right.reverse()]), (px, py) => {
    const dx = px + 0.5 - ax, dy = py + 0.5 - ay;
    const lx = dx * ct + dy * st;
    const ly = -dx * st + dy * ct;
    const v = (ly - top) / length;
    for (const sgn of [-1, 1])
      for (const sv of [0.28, 0.44])
        if ((lx - sgn * 0.5 * wmax) ** 2 + ((v - sv) * length) ** 2 < 1.4) return GOLD;
    const u = Math.min(Math.max(v + (0.16 * lx) / wmax, 0), 0.9999);
    let acc = 0;
    let c = bands[bands.length - 1][0];
    for (const [color, share] of bands) {
      if (u < acc + share) { c = color; break; }
      acc += share;
    }
    const [dark, base, light] = tones(c);
    if (lx < -0.35 * wmax) return light;
    if (lx > 0.35 * wmax) return dark;
    return base;
  });
}

// ----------------------------------------------------------------------------- butterfly
const FORE = chaikin([[1, -1], [3, -9], [8, -16], [15, -20], [22, -19], [25, -14], [23, -8], [17, -3], [9, 0]]);
const HIND = chaikin([[1, 1], [9, 2], [16, 5], [19, 10], [17, 16], [11, 18], [5, 14], [2, 8]]);
type Spot = [number, number, number, RGB];
const FORE_SPOTS: Spot[] = [[14, -9, 1.5, OUTLINE], [18, -6, 1.2, OUTLINE], [11, -5, 1.1, OUTLINE], [19, -15, 1.7, CREAM]];
const HIND_SPOTS: Spot[] = [[11, 10, 1.4, OUTLINE], [7, 7, 1.1, OUTLINE], [14, 13, 1.1, CREAM]];

/** o: 0 at the wing tip .. 1 at the body. Bands run tip -> body, then a warm glow at the root. */
function bandColor(o: number, bands: Band[]): RGB {
  const ob = Math.min(o / 0.84, 0.9999);
  let acc = 0;
  let c = bands[bands.length - 1][0];
  let local = 0.5;
  for (const [color, share] of bands) {
    if (ob < acc + share) { c = color; local = (ob - acc) / share; break; }
    acc += share;
  }
  const [dark, base, light] = tones(c);
  const out = local < 0.34 ? dark : local < 0.67 ? base : light;
  if (o > 0.86) return mix(out, CREAM, 0.85);
  if (o > 0.72) return mix(out, CREAM, 0.6);
  if (o > 0.6) return mix(out, CREAM, 0.3);
  return out;
}

function drawWing(
  cv: Canvas, pts: Pt[], ox: number, oy: number, s: number, f: number, flip: number,
  bands: Band[], radius: number, spots: Spot[],
): void {
  const poly: Pt[] = pts.map(([x, y]) => [ox + flip * x * s * f, oy + y * s]);
  cv.paint(cv.polyMask(poly), (x, y) => {
    const ux = ((x + 0.5 - ox) * flip) / (s * f);
    const uy = (y + 0.5 - oy) / s;
    for (const [sx, sy, r, c] of spots) if ((ux - sx) ** 2 + (uy - sy) ** 2 <= r * r) return c;
    const d = Math.hypot(ux, uy) / radius + 0.028 * (Math.floor((ux + uy) / 2.4) & 1);
    return bandColor(1 - Math.min(Math.max(d, 0), 1), bands);
  });
}

function drawBody(cv: Canvas, ox: number, oy: number, s: number, wobble: number): void {
  const top = oy - 8 * s, bot = oy + 10 * s;
  const half = Math.max(1, 1.7 * s);
  cv.ellipse(ox - half, oy - 4 * s, ox + half, bot, BODY);
  cv.ellipse(ox - half - 0.5, oy - 6 * s, ox + half + 0.5, oy + s, BODY_LIGHT);
  cv.ellipse(ox - 1.6 * s, top - 1.5 * s, ox + 1.6 * s, top + 1.6 * s, BODY);
  for (const k of [-1, 1]) {
    const tipX = ox + k * 7 * s + wobble * k, tipY = top - 11 * s;
    cv.line([[ox + k * 0.8, top - 1], [ox + k * 2.5 * s, top - 6 * s], [tipX, tipY]], OUTLINE);
    cv.put(tipX, tipY, OUTLINE);
    cv.put(tipX, tipY - 1, OUTLINE);
  }
}

/** Her figure-8 flight path; t in 0..1 loops perfectly. */
function flightPath(t: number, s: number): Pt {
  const mx = (W - 58 * s) / 2 - 2;
  const my = (H - 44 * s) / 2 - 1;
  return [W / 2 + mx * Math.sin(TAU * t), H / 2 + 1 + my * Math.sin(2 * TAU * t)];
}

function drawButterfly(cv: Canvas, g: Growth, bands: Band[], t: number, streak: number): void {
  const s = g.scale;
  // Sparkle trail: one sparkle per few streak days, fading and shrinking behind her.
  const n = streak < 3 ? 0 : Math.min(9, 2 + Math.floor(streak / 3));
  for (let k = n; k >= 1; k--) {
    let [px, py] = flightPath(t - k * 0.016, s);
    px += ((k * 7) % 5) - 2;
    py += 6 * s + ((k * 3) % 5) - 2;
    const c = tones(bands[k % bands.length][0])[2];
    if (k < 5) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) cv.put(px + dx, py + dy, c);
    else cv.put(px, py, c);
  }

  const phase = TAU * 10 * t; // ten wing beats per loop
  const f = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(phase));
  const [ox, oyBase] = flightPath(t, s);
  const oy = oyBase + 1.6 * s * Math.sin(phase);
  for (const flip of [-1, 1]) drawWing(cv, HIND, ox, oy, s, f, flip, bands, 23, HIND_SPOTS);
  for (const flip of [-1, 1]) drawWing(cv, FORE, ox, oy, s, f, flip, bands, 29, FORE_SPOTS);
  drawBody(cv, ox, oy, s, 0.8 * Math.sin(phase));
}

// ----------------------------------------------------------------------------- frames
export function renderFrame(stats: Stats, g: Growth, t: number): Canvas {
  const bands = wingBands(stats.languages);
  const cv = new Canvas(W, H);
  if (g.stage === "egg") drawEgg(cv, g, bands, t);
  else if (g.stage === "caterpillar") drawCaterpillar(cv, g, bands, t);
  else if (g.stage === "cocoon") drawCocoon(cv, g, bands, t);
  else drawButterfly(cv, g, bands, t, stats.streak);
  return cv;
}

export function renderFrames(stats: Stats, g: Growth, n = FRAMES): Canvas[] {
  return Array.from({ length: n }, (_, i) => renderFrame(stats, g, i / n));
}
