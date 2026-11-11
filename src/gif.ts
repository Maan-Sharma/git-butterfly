/** Write transparent, looping, pixel-perfect GIFs from low-resolution RGBA frames. */
import gifenc from "gifenc"; // CommonJS package: take its exports from the default import
import type { Canvas } from "./raster.js";

const { GIFEncoder } = gifenc;

type Key = number;
const pack = (r: number, g: number, b: number): Key => (r << 16) | (g << 8) | b;

/** Quantize by dropping low bits until the palette fits in 255 entries. */
function reduce(colors: Set<Key>): { shift: number; keyed: Set<Key> } {
  for (let shift = 0; ; shift++) {
    const keyed = new Set<Key>();
    for (const c of colors) {
      const r = (((c >> 16) & 255) >> shift) << shift;
      const g = (((c >> 8) & 255) >> shift) << shift;
      const b = ((c & 255) >> shift) << shift;
      keyed.add(pack(r, g, b));
    }
    if (keyed.size <= 255) return { shift, keyed };
  }
}

export function encodeGif(frames: Canvas[], scale = 4, delay = 70): Uint8Array {
  const colors = new Set<Key>();
  for (const f of frames)
    for (let i = 0; i < f.data.length; i += 4) if (f.data[i + 3]) colors.add(pack(f.data[i], f.data[i + 1], f.data[i + 2]));
  const { shift, keyed } = reduce(colors);
  const sorted = [...keyed].sort((a, b) => a - b);
  const index = new Map<Key, number>(sorted.map((c, i) => [c, i + 1])); // 0 = transparent
  const palette: number[][] = [[0, 0, 0], ...sorted.map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255])];
  while (palette.length < 256) palette.push([0, 0, 0]);

  const { w, h } = frames[0];
  const enc = GIFEncoder();
  for (const f of frames) {
    const small = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (!f.data[i + 3]) continue;
      const k = pack((f.data[i] >> shift) << shift, (f.data[i + 1] >> shift) << shift, (f.data[i + 2] >> shift) << shift);
      small[p] = index.get(k) ?? 0;
    }
    const big = new Uint8Array(w * scale * h * scale);
    for (let y = 0; y < h * scale; y++)
      for (let x = 0; x < w * scale; x++) big[y * w * scale + x] = small[Math.floor(y / scale) * w + Math.floor(x / scale)];
    enc.writeFrame(big, w * scale, h * scale, {
      palette,
      transparent: true,
      transparentIndex: 0,
      delay,
      dispose: 2,
      repeat: 0,
    });
  }
  enc.finish();
  return enc.bytes();
}
