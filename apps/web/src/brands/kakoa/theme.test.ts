import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The palette is tokenised: packages/ui/src/tokens.css declares the shared
 * token NAMES with KAKOA's values as defaults, and this pack's theme.css
 * re-declares the same names from an unlayered :root. Two invariants keep the
 * KAKOA render pixel-identical and the mechanism trustworthy for a second brand:
 *
 *  1. every variable theme.css sets exists in tokens.css (no typo'd override
 *     that silently does nothing) and, for KAKOA, carries the same value;
 *  2. no storefront source outside tokens.css and the brand packs carries the
 *     chrome hexes the tokens replaced — a literal would not re-skin.
 */
const WEB_SRC = path.resolve(__dirname, "../..");
const TOKENS_CSS = path.resolve(WEB_SRC, "../../../packages/ui/src/tokens.css");
const THEME_CSS = path.resolve(__dirname, "theme.css");

/** `--name: value;` declarations, values lower-cased and whitespace-normalised. */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  for (const m of css.matchAll(re)) {
    out.set(m[1]!, m[2]!.trim().replace(/\s+/g, " ").toLowerCase());
  }
  return out;
}

/** Names the KAKOA override is REQUIRED to set (what a second brand must mirror). */
const REQUIRED = [
  "--color-ink",
  "--color-cocoa",
  "--color-espresso",
  "--color-cream",
  "--color-card",
  "--color-line",
  "--color-gold",
  "--color-field",
  "--color-field-ink",
  "--color-field-light",
  "--color-field-deep",
  "--color-selection",
  "--color-scrollbar",
  "--color-scrollbar-hover",
  "--shadow-tint",
  "--color-avatar-honey",
  "--color-avatar-clay-deep",
  "--color-confetti-gold",
  "--color-confetti-espresso",
];

describe("brands/kakoa/theme.css", () => {
  const tokens = declarations(readFileSync(TOKENS_CSS, "utf8"));
  const theme = declarations(readFileSync(THEME_CSS, "utf8"));

  it("sets every brand surface token", () => {
    for (const name of REQUIRED) {
      expect(theme.has(name), `${name} missing from theme.css`).toBe(true);
    }
  });

  it("overrides only names tokens.css declares", () => {
    const unknown = [...theme.keys()].filter((name) => !tokens.has(name));
    expect(unknown).toEqual([]);
  });

  it("matches the shared defaults exactly (KAKOA renders pixel-identical)", () => {
    const drift = [...theme.entries()]
      .filter(([name, value]) => tokens.get(name) !== value)
      .map(([name, value]) => `${name}: ${value} vs ${tokens.get(name)}`);
    expect(drift).toEqual([]);
  });

  it("never re-declares platform tokens (spacing, radius, type scale, motion)", () => {
    const platform = [...theme.keys()].filter((name) =>
      /^--(space|radius|text|breakpoint|ease|duration|font)-/.test(name),
    );
    expect(platform).toEqual([]);
  });
});

/** Chrome hexes the tokens replaced; a literal anywhere else would not re-skin. */
const CHROME_HEX = /#(683126|fcf5e8|fef6eb|8a4a33|3c1c12|4a331f)\b/i;

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "brands" || entry === "node_modules") continue;
      yield* sourceFiles(full);
    } else if (/\.(tsx?|css)$/.test(entry) && !entry.endsWith(".test.ts")) {
      yield full;
    }
  }
}

describe("storefront palette", () => {
  it("carries no chrome hex outside tokens.css and the brand packs", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(WEB_SRC)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (CHROME_HEX.test(line)) {
          offenders.push(`${path.relative(WEB_SRC, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
