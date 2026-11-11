/** A tiny 3x5 pixel font (A-Z, 0-9 and a few symbols) for labels drawn inside the GIF. */
import type { RGB } from "./palette.js";
import type { Canvas } from "./raster.js";

const GLYPHS: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
  "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010",
  "8": "111101111101111", "9": "111101111001110",
  "+": "000010111010000", "#": "101111101111101", "-": "000000111000000", ".": "000000000000010",
  " ": "000000000000000",
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;

/** Width in pixels of the text (1px gap between letters). */
export function textWidth(text: string): number {
  return text.length ? text.length * (GLYPH_W + 1) - 1 : 0;
}

/** Draw text with its top-left corner at (x, y). Unknown characters are skipped as spaces. */
export function drawText(cv: Canvas, text: string, x: number, y: number, color: RGB): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (let i = 0; i < g.length; i++) if (g[i] === "1") cv.put(cx + (i % GLYPH_W), y + Math.floor(i / GLYPH_W), color);
    cx += GLYPH_W + 1;
  }
}
