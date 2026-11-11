/** One PNG showing every life stage, on a light and a dark background. */
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { growth, type Lang } from "./model.js";
import { H, W, renderFrame } from "./render.js";

const SAMPLES: Array<[string, number]> = [
  ["egg", 10],
  ["caterpillar", 150],
  ["cocoon", 550],
  ["butterfly", 800],
  ["grown", 5000],
];

export function makeSheet(path: string, languages: Lang[], scale = 3): void {
  const cw = W * scale, ch = H * scale;
  const png = new PNG({ width: cw * SAMPLES.length, height: ch * 2 });
  const backgrounds = [[255, 247, 252], [13, 17, 23]];
  backgrounds.forEach((bg, row) => {
    SAMPLES.forEach(([, total], col) => {
      const g = growth(total);
      const frame = renderFrame({ login: "demo", total, streak: 6, languages }, g, g.stage === "butterfly" ? 0.5 : g.stage === "caterpillar" ? 0.08 : 0.3);
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++) {
          const s = (Math.floor(y / scale) * W + Math.floor(x / scale)) * 4;
          const d = ((row * ch + y) * png.width + col * cw + x) * 4;
          const a = frame.data[s + 3] / 255;
          for (let k = 0; k < 3; k++) png.data[d + k] = Math.round(frame.data[s + k] * a + bg[k] * (1 - a));
          png.data[d + 3] = 255;
        }
    });
  });
  writeFileSync(path, PNG.sync.write(png));
}
