/** Colors: language colors (made extra pretty) plus the fixed sprite colors. */
import { createHash } from "node:crypto";

export type RGB = [number, number, number];

export const OUTLINE: RGB = [38, 20, 48];
export const CREAM: RGB = [255, 214, 140];
export const BODY: RGB = [62, 38, 34];
export const BODY_LIGHT: RGB = [116, 74, 52];
export const BRANCH: RGB = [122, 80, 56];
export const BRANCH_LIGHT: RGB = [160, 112, 76];
export const LEAF: RGB = [86, 176, 92];
export const LEAF_DARK: RGB = [52, 128, 74];
export const LEAF_LIGHT: RGB = [150, 214, 112];
export const GOLD: RGB = [255, 220, 96];

/** GitHub "linguist" colors, used when GitHub gives no color and for the offline --langs option. */
export const LINGUIST: Record<string, string> = {
  Python: "#3572A5",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Dart: "#00B4AB",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Shell: "#89e051",
  "Jupyter Notebook": "#DA5B0B",
  R: "#198CE7",
  Lua: "#000080",
  Vue: "#41b883",
  Dockerfile: "#384d54",
  Makefile: "#427819",
};

export function hexToRgb(hex: string): RGB {
  const h = hex.replace(/^#/, "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
}

function hashHue(name: string): number {
  return parseInt(createHash("md5").update(name).digest("hex").slice(0, 4), 16) / 65535;
}

function rgbToHsv([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Make a color vivid and bright enough to look good as a wing. */
export function prettify(rgb: RGB, name = ""): RGB {
  let [h, s, v] = rgbToHsv(rgb);
  if (s < 0.12) h = hashHue(name); // greys have no hue, so borrow one from the language name
  s = Math.min(Math.max(s, 0.5), 0.9);
  v = Math.max(v, 0.74);
  return hsvToRgb(h, s, v);
}

export function languageColor(name: string, hex?: string | null): RGB {
  let base: RGB;
  if (hex) base = hexToRgb(hex);
  else if (LINGUIST[name]) base = hexToRgb(LINGUIST[name]);
  else base = hsvToRgb(hashHue(name), 0.7, 0.9);
  return prettify(base, name);
}

const toneCache = new Map<string, [RGB, RGB, RGB]>();

/** (dark, base, light) shades that give every wing band a pixel-art ramp. */
export function tones(rgb: RGB): [RGB, RGB, RGB] {
  const key = rgb.join(",");
  let t = toneCache.get(key);
  if (!t) {
    t = [mix(rgb, [60, 10, 70], 0.3), rgb, mix(rgb, [255, 255, 255], 0.34)];
    toneCache.set(key, t);
  }
  return t;
}
