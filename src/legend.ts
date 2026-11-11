/** A "Languages by repo count" card as a small SVG: a colored bar plus a two-column legend. */
import type { Lang, RepoLang } from "./model.js";
import { rawLanguageColor } from "./palette.js";

const WIDTH = 480;
const PAD = 24;

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Turn the wing-color weights into legend entries (used for --demo and --langs). */
export function legendFromWeights(langs: Lang[]): RepoLang[] {
  return langs.map((l) => ({ name: l.name, color: rawLanguageColor(l.name), count: l.weight }));
}

export function renderLegend(langs: RepoLang[], maxItems = 10): string {
  let items = [...langs].filter((l) => l.count > 0).sort((a, b) => b.count - a.count);
  if (items.length > maxItems) {
    const rest = items.slice(maxItems - 1);
    items = [
      ...items.slice(0, maxItems - 1),
      { name: "Other", color: "#8b949e", count: rest.reduce((s, l) => s + l.count, 0) },
    ];
  }
  const total = items.reduce((s, l) => s + l.count, 0);
  const barW = WIDTH - PAD * 2;
  const barY = 46, barH = 10;
  const rows = Math.max(1, Math.ceil(items.length / 2));
  const height = barY + barH + 22 + rows * 26 + 14;

  let body = "";
  if (!total) {
    body = `<text class="t" x="${PAD}" y="${barY + 8}" font-size="13">No languages yet. Push some code!</text>`;
  } else {
    let x = PAD;
    const segments = items
      .map((l) => {
        const w = (l.count / total) * barW;
        const rect = `<rect x="${x.toFixed(2)}" y="${barY}" width="${w.toFixed(2)}" height="${barH}" fill="${escapeXml(l.color)}"/>`;
        x += w;
        return rect;
      })
      .join("");
    const rowsSvg = items
      .map((l, i) => {
        const col = Math.floor(i / rows); // fill the left column first, like GitHub's card
        const row = i % rows;
        const lx = PAD + col * (barW / 2);
        const ly = barY + barH + 30 + row * 26;
        const pct = ((l.count / total) * 100).toFixed(2);
        return (
          `<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${escapeXml(l.color)}"/>` +
          `<text class="t" x="${lx + 18}" y="${ly}" font-size="13">${escapeXml(l.name)} ${pct}%</text>`
        );
      })
      .join("");
    body =
      `<clipPath id="bar"><rect x="${PAD}" y="${barY}" width="${barW}" height="${barH}" rx="${barH / 2}"/></clipPath>` +
      `<g clip-path="url(#bar)">${segments}</g>${rowsSvg}`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="Languages by repo count">` +
    `<title>Languages by repo count</title>` +
    `<style>text{font-family:-apple-system,"Segoe UI",Ubuntu,"Helvetica Neue",Arial,sans-serif}` +
    `.t{fill:#24292f}.h{fill:#6f5bd8}` +
    `@media (prefers-color-scheme: dark){.t{fill:#c9d1d9}.h{fill:#a78bfa}}</style>` +
    `<text class="h" x="${PAD}" y="26" font-size="19" font-weight="600">Languages by repo count</text>` +
    body +
    `</svg>\n`
  );
}
