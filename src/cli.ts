#!/usr/bin/env node
/** Command line: git-butterfly --user NAME --out butterfly.gif */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { FetchError, fetchStats } from "./fetch.js";
import { encodeGif } from "./gif.js";
import { DEFAULT_THRESHOLDS, growth, type Lang, type Stats, type Thresholds } from "./model.js";
import { languageColor } from "./palette.js";
import { renderFrames } from "./render.js";
import { makeSheet } from "./sheet.js";

const DEMO_LANGS = "Python:38,JavaScript:24,TypeScript:14,HTML:9,CSS:6";

const HELP = `git-butterfly: draw a pixel-art butterfly from your GitHub activity

  git-butterfly --user NAME [--out butterfly.gif]
  git-butterfly --demo --out demo.gif

Options
  --user NAME         GitHub username
  --token TOKEN       GitHub token (default: $GITHUB_TOKEN or $GH_TOKEN)
  --out PATH          output GIF (default butterfly.gif)
  --scale N           pixel size multiplier (default 4 -> 640x360)
  --thresholds A,B,C  contributions for caterpillar,cocoon,butterfly (default 25,300,800)
  --demo              made-up stats, no network needed
  --total N           override total contributions
  --streak N          override streak days
  --langs LIST        override languages, e.g. "Python:50,Rust:30,Go:20"
  --sheet PATH        also write a PNG showing every life stage
`;

export function parseLangs(text: string): Lang[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, weight] = part.split(":");
      return { name: name.trim(), color: languageColor(name.trim()), weight: Number(weight ?? 1) || 1 };
    });
}

export function parseThresholds(text: string): Thresholds {
  const nums = text.split(",").map((x) => Number.parseInt(x, 10));
  if (nums.length !== 3 || nums.some(Number.isNaN)) throw new Error("--thresholds needs three numbers, e.g. 25,300,800");
  return nums as Thresholds;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      user: { type: "string" },
      token: { type: "string" },
      out: { type: "string", default: "butterfly.gif" },
      scale: { type: "string", default: "4" },
      thresholds: { type: "string" },
      demo: { type: "boolean", default: false },
      total: { type: "string" },
      streak: { type: "string" },
      langs: { type: "string" },
      sheet: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  let stats: Stats;
  if (values.demo) {
    stats = { login: "demo", total: 1200, streak: 5, languages: parseLangs(DEMO_LANGS) };
  } else if (values.user) {
    const token = values.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    if (!token) {
      console.error("error: set GITHUB_TOKEN (or pass --token)");
      return 2;
    }
    try {
      stats = await fetchStats(values.user, token);
    } catch (e) {
      if (e instanceof FetchError) {
        console.error(`error: ${e.message}`);
        return 1;
      }
      throw e;
    }
  } else {
    console.error("error: give --user NAME (or --demo to try it offline)\n\n" + HELP);
    return 2;
  }
  if (values.total !== undefined) stats.total = Number(values.total);
  if (values.streak !== undefined) stats.streak = Number(values.streak);
  if (values.langs) stats.languages = parseLangs(values.langs);

  const thresholds = values.thresholds ? parseThresholds(values.thresholds) : DEFAULT_THRESHOLDS;
  const g = growth(stats.total, thresholds);
  const out = resolve(values.out!);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodeGif(renderFrames(stats, g), Number(values.scale)));
  if (values.sheet) makeSheet(resolve(values.sheet), stats.languages);

  const top = [...stats.languages].sort((a, b) => b.weight - a.weight).slice(0, 4).map((l) => l.name).join(", ") || "none yet";
  console.log(
    `${stats.login}: ${stats.total} contributions, ${stats.streak}-day streak -> ${g.stage} ` +
      `(${Math.round(g.progress * 100)}%, size x${g.scale.toFixed(2)}); wing colors from: ${top}`,
  );
  console.log(`wrote ${values.out}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
