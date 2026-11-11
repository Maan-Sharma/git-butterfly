/** A tiny hard-edged RGBA canvas with just the shapes the sprites need (no anti-aliasing, no native deps). */
import { OUTLINE, type RGB } from "./palette.js";

export type Pt = [number, number];

export class Canvas {
  readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  put(x: number, y: number, c: RGB): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = 255;
  }

  /** Straight line through the given points (Bresenham). */
  line(pts: Pt[], c: RGB): void {
    for (let k = 0; k + 1 < pts.length; k++) {
      let [x0, y0] = pts[k].map(Math.round);
      const [x1, y1] = pts[k + 1].map(Math.round);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.put(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
  }

  /** Solid rectangle with a 1px outline inside its bounds. */
  rect(x0: number, y0: number, x1: number, y1: number, fill: RGB, outline: RGB = OUTLINE): void {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        this.put(x, y, x === x0 || x === x1 || y === y0 || y === y1 ? outline : fill);
  }

  polyMask(pts: Pt[]): Uint8Array {
    const m = new Uint8Array(this.w * this.h);
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(this.w - 1, Math.ceil(maxX));
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) m[y * this.w + x] = 1;
      }
    }
    return m;
  }

  ellipseMask(x0: number, y0: number, x1: number, y1: number): Uint8Array {
    const m = new Uint8Array(this.w * this.h);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rx = Math.max(0.55, (x1 - x0) / 2), ry = Math.max(0.55, (y1 - y0) / 2);
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(this.h - 1, Math.ceil(cy + ry)); y++)
      for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(this.w - 1, Math.ceil(cx + rx)); x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) m[y * this.w + x] = 1;
    return m;
  }

  /** Fill the mask with colorFn(x, y) and add a 1px dark outline around it. */
  paint(mask: Uint8Array, colorFn: (x: number, y: number) => RGB, outline: RGB | null = OUTLINE): void {
    const { w, h } = this;
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x]) this.put(x, y, colorFn(x, y));
        else if (outline) {
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++)
            for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy)) { near = true; break; }
          if (near) this.put(x, y, outline);
        }
      }
  }

  ellipse(x0: number, y0: number, x1: number, y1: number, fill: RGB, outline: RGB | null = OUTLINE): void {
    this.paint(this.ellipseMask(x0, y0, x1, y1), () => fill, outline);
  }
}
