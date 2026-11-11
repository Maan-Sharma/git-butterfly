import assert from "node:assert/strict";
import { test } from "node:test";
import { currentStreak } from "../src/fetch.js";
import { growth, wingBands } from "../src/model.js";
import { languageColor } from "../src/palette.js";
import { FRAMES, renderFrames } from "../src/render.js";
import { encodeGif } from "../src/gif.js";

test("life stage follows total contributions", () => {
  assert.equal(growth(0).stage, "egg");
  assert.equal(growth(24).stage, "egg");
  assert.equal(growth(25).stage, "caterpillar");
  assert.equal(growth(299).stage, "caterpillar");
  assert.equal(growth(300).stage, "cocoon");
  assert.equal(growth(800).stage, "butterfly");
});

test("butterfly grows bigger with more contributions, up to a cap", () => {
  const small = growth(800).scale, mid = growth(2000).scale, full = growth(9999).scale;
  assert.ok(small < mid && mid < full);
  assert.equal(growth(4000).scale, growth(100000).scale);
});

test("custom thresholds are validated", () => {
  assert.throws(() => growth(10, [300, 25, 800]));
  assert.equal(growth(10, [5, 20, 40]).stage, "caterpillar");
});

test("wing bands sum to 1, biggest language first, tiny ones dropped", () => {
  const langs = [
    { name: "A", color: languageColor("Python"), weight: 70 },
    { name: "B", color: languageColor("Rust"), weight: 29 },
    { name: "C", color: languageColor("Go"), weight: 0.5 },
  ];
  const bands = wingBands(langs);
  assert.equal(bands.length, 2);
  assert.ok(Math.abs(bands.reduce((s, b) => s + b[1], 0) - 1) < 1e-9);
  assert.ok(bands[0][1] > bands[1][1]);
});

test("no language data falls back to the default pink/orange wings", () => {
  assert.equal(wingBands([]).length, 3);
});

test("greys from linguist (e.g. C) become a vivid color", () => {
  const [r, g, b] = languageColor("C");
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) > 60);
});

test("streak counts back from today, or from yesterday if today is empty", () => {
  const today = new Date(Date.UTC(2026, 10, 11));
  const days: Array<[string, number]> = [["2026-11-11", 2], ["2026-11-10", 1], ["2026-11-09", 4], ["2026-11-08", 0]];
  assert.equal(currentStreak(days, today), 3);
  assert.equal(currentStreak([["2026-11-11", 0], ["2026-11-10", 1], ["2026-11-09", 1]], today), 2);
  assert.equal(currentStreak([["2026-11-11", 0], ["2026-11-10", 0]], today), 0);
});

test("every stage renders a looping transparent GIF", () => {
  for (const total of [5, 100, 500, 1000]) {
    const stats = { login: "t", total, streak: 7, languages: [] };
    const frames = renderFrames(stats, growth(total), 6);
    assert.equal(frames.length, 6);
    assert.ok(frames.some((f) => f.data.some((v, i) => i % 4 === 3 && v === 255)), "has pixels");
    assert.ok(frames[0].data[3] === 0, "corner stays transparent");
    const gif = encodeGif(frames, 2);
    assert.equal(Buffer.from(gif.slice(0, 6)).toString(), "GIF89a");
  }
  assert.equal(FRAMES, 60);
});
