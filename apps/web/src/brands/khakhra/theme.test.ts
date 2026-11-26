import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The second brand is what proves the palette mechanism: this pack's
 * theme.css must declare exactly the token NAMES the KAKOA pack declares (and
 * tokens.css ships), with its own VALUES, and every text-on-field pair the
 * storefront renders must still clear WCAG AA for body text (4.5:1).
 */
const TOKENS_CSS = path.resolve(__dirname, "../../../../../packages/ui/src/tokens.css");
const KAKOA_THEME_CSS = path.resolve(__dirname, "../kakoa/theme.css");
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

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The text / field pairs the storefront renders at body size. */
const AA_PAIRS: readonly [string, string][] = [
  ["--color-ink", "--color-cream"],
  ["--color-ink-body", "--color-cream"],
  ["--color-ink-soft", "--color-cream"],
  ["--color-ink", "--color-card"],
  ["--color-ink-body", "--color-surface"],
  ["--color-field-ink", "--color-field"],
  ["--color-field-ink", "--color-field-light"],
  ["--color-field-ink", "--color-field-deep"],
  ["--color-cream", "--color-ink"],
  ["--color-pistachio-deep", "--color-card"],
];

describe("brands/khakhra/theme.css", () => {
  const tokens = declarations(readFileSync(TOKENS_CSS, "utf8"));
  const kakoa = declarations(readFileSync(KAKOA_THEME_CSS, "utf8"));
  const theme = declarations(readFileSync(THEME_CSS, "utf8"));

  it("declares exactly the token names the KAKOA pack declares", () => {
    expect([...theme.keys()].sort()).toEqual([...kakoa.keys()].sort());
  });

  it("overrides only names tokens.css declares", () => {
    const unknown = [...theme.keys()].filter((name) => !tokens.has(name));
    expect(unknown).toEqual([]);
  });

  it("is a new palette, not a copy of the defaults", () => {
    const same = [...theme.entries()].filter(([name, value]) => tokens.get(name) === value);
    // Pure white surface is shared by design; everything else must move.
    expect(same.map(([name]) => name)).toEqual(["--color-surface"]);
  });

  it("never re-declares platform tokens (spacing, radius, type scale, motion)", () => {
    const platform = [...theme.keys()].filter((name) =>
      /^--(space|radius|text|breakpoint|ease|duration|font)-/.test(name),
    );
    expect(platform).toEqual([]);
  });

  it("uses #rrggbb for every colour and an RGB triplet for the shadow tint", () => {
    for (const [name, value] of theme) {
      if (name === "--shadow-tint") expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
      else expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps every text-on-field pair at WCAG AA (4.5:1) or better", () => {
    for (const [fg, bg] of AA_PAIRS) {
      const ratio = contrast(theme.get(fg)!, theme.get(bg)!);
      expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("matches the profile's theme-color / background-color", () => {
    expect(theme.get("--color-field")).toBe("#8c3b1c");
    expect(theme.get("--color-cream")).toBe("#fff7e6");
  });
});
