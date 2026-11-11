import assert from "node:assert/strict";
import { test } from "node:test";
import { currentStreak } from "../src/fetch.js";
import { growth, topLangs, wingBands } from "../src/model.js";
import { languageColor } from "../src/palette.js";
import { renderLegend } from "../src/legend.js";
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

test("legend shows every language with its real color and percentages", () => {
  const svg = renderLegend([
    { name: "Python", color: "#3572A5", count: 8 },
    { name: "JavaScript", color: "#f1e05a", count: 5 },
    { name: "C", color: "#555555", count: 3 },
    { name: "Java", color: "#b07219", count: 2 },
    { name: "Rust", color: "#dea584", count: 1 },
    { name: "TypeScript", color: "#3178c6", count: 1 },
  ]);
  assert.ok(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"));
  assert.ok(svg.includes("Python 40.00%") && svg.includes("JavaScript 25.00%") && svg.includes("Rust 5.00%"));
  assert.ok(svg.includes('fill="#555555"'), "keeps the real grey for C");
});

test("legend groups extra languages into Other and escapes names", () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ name: `L${i}`, color: "#123456", count: 14 - i }));
  assert.ok(renderLegend(many).includes("Other"));
  assert.ok(renderLegend([{ name: "C<&>", color: "#123456", count: 1 }]).includes("C&lt;&amp;&gt;"));
  assert.ok(renderLegend([]).includes("No languages yet"));
});

test("caterpillar shows name tags for her languages, not for the default palette", () => {
  const langs = ["Python", "JavaScript", "C", "Java", "Rust", "TypeScript"].map((n, i) => ({
    name: n, color: languageColor(n), weight: 40 - i * 5,
  }));
  assert.equal(topLangs(langs).length, 6);
  assert.equal(topLangs([{ name: "default", color: [1, 2, 3] as [number, number, number], weight: 1 }]).length, 0);
  const tagged = renderFrames({ login: "t", total: 100, streak: 0, languages: langs }, growth(100), 1)[0];
  const plain = renderFrames({ login: "t", total: 100, streak: 0, languages: [] }, growth(100), 1)[0];
  const opaqueBelow = (c: typeof tagged) => c.data.filter((v, i) => i % 4 === 3 && v === 255 && i / 4 >= 74 * 160).length;
  assert.ok(opaqueBelow(tagged) > opaqueBelow(plain) + 200, "tags add pixels at the bottom");
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
