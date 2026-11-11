import { describe, expect, it } from "vitest";
import { brand } from "./index";
import { email } from "./email";
import { og, icon } from "./og";
import type { NotificationCopy, NotificationsCopy } from "../contract";
import { TEMPLATE_CATALOG, unknownPlaceholders } from "@/lib/admin/notification-catalog";
import type { CompanyInfo } from "@/lib/catalog/queries";

/** The pack's notification copy read through the contract type (widened: `subject` optional). */
const NOTIFICATIONS: NotificationsCopy = brand.copy.notifications;

/**
 * The Khakhra House pack's CONTENT half: the typecheck proves every block
 * exists (`satisfies BrandPack`); these tests prove the data is coherent — the
 * FAQ interpolates the live company values, the notification defaults only use
 * placeholders the catalog allows, the journal is deliberately empty, the pack
 * carries this brand's own words, and NOTHING in it promises a cold chain.
 *
 * `TEMPLATE_CATALOG` is built from the `@brand` alias (the KAKOA pack under
 * vitest), so only its placeholder lists are shared here — never its defaults.
 */

const COMPANY: CompanyInfo = {
  legalName: "Acme Foods Private Limited",
  address: "1 Market Road, Ahmedabad 380001",
  gstin: "24AAAAA0000A1Z5",
  fssai: "10025023000841",
  legalIdentityConfigured: true,
  supportEmail: "care@acme.test",
  supportPhone: "+919876543210",
  supportHours: "Mon–Sat, 09:00–17:00 IST",
  grievanceName: "Grievance Officer",
  countryOfOrigin: "India",
  freeShippingThresholdPaise: 99900,
  standardShippingPaise: 4900,
  expressShippingPaise: 14900,
  codEnabled: true,
  codFeePaise: 4900,
  policy: {
    legalEffectiveDate: "1 January 2027",
    damageReportWindowHours: 72,
    refundSlaDays: "3–5",
    dispatchSlaDays: "1",
    deliveryEtaDays: "2–9",
  },
};

/** Every string the pack can render, lower-cased (copy, FAQ, legal, email, OG). */
function packText(): string[] {
  const leaves: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") leaves.push(value.toLowerCase());
    else if (typeof value === "function") walk((value as (...args: string[]) => unknown)("Methi Khakhra", "pack"));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(brand.copy);
  walk(brand.legal);
  walk(brand.email.copy);
  walk(brand.email.footerTagline);
  walk(og);
  walk(brand.faq(COMPANY));
  return leaves;
}

describe("Khakhra House pack — FAQ", () => {
  it("interpolates contact details, fees, COD and the policy SLAs from the company info", () => {
    const faq = brand.faq(COMPANY);
    const text = faq.flatMap((g) => g.items.map((i) => `${i.q}\n${i.a}`)).join("\n");
    expect(faq.map((g) => g.category)).toEqual([
      "Orders & shipping",
      "Storage & shelf life",
      "Returns & refunds",
      "Gifting",
      "Ingredients & allergens",
      "Account & payments",
    ]);
    expect(text).toContain("care@acme.test");
    expect(text).toContain("+919876543210");
    expect(text).toContain("FSSAI Lic. No. 10025023000841");
    expect(text).toContain("₹999");
    expect(text).toContain("Cash on Delivery is also available");
    expect(text).toContain("within 72 hours");
    expect(text).toContain("within 3–5 business days");
    expect(text).toContain("dispatched within 1 business days");
    expect(text).toContain("within 2–9 business days");
    // Nothing from the fixture-free defaults leaked in.
    expect(text).not.toMatch(/48 hours|5–7 business|1–2 business|3–7 business/);
  });

  it("answers the shelf-stable questions: breakage, storage, shelf life, packaged-food returns, allergens", () => {
    const text = brand.faq(COMPANY).flatMap((g) => g.items.map((i) => `${i.q}\n${i.a}`)).join("\n");
    expect(text).toMatch(/break in transit/i);
    expect(text).toMatch(/airtight container, away from moisture/i);
    expect(text).toMatch(/three months/i);
    expect(text).toMatch(/once the pack has been opened/i);
    expect(text).toMatch(/wheat \(gluten\)/i);
    expect(text).toMatch(/sesame/i);
    expect(text).toMatch(/veg \/ non-veg mark/i);
  });

  it("drops the FSSAI parenthetical and says prepaid-only when those settings are absent", () => {
    const faq = brand.faq({ ...COMPANY, fssai: "", codEnabled: false, freeShippingThresholdPaise: null });
    const text = faq.flatMap((g) => g.items.map((i) => i.a)).join("\n");
    expect(text).not.toContain("FSSAI Lic. No.");
    expect(text).toContain("prepaid-only");
    expect(text).toContain("We offer free shipping on eligible orders");
  });
});

describe("Khakhra House pack — notification defaults", () => {
  it("covers every catalog template and uses only the placeholders it allows", () => {
    for (const entry of TEMPLATE_CATALOG) {
      const copy: NotificationCopy | undefined =
        NOTIFICATIONS[`${entry.key}.${entry.channel}` as keyof NotificationsCopy];
      expect(copy, `${entry.key}.${entry.channel}`).toBeDefined();
      if (copy === undefined) continue;
      expect(unknownPlaceholders(copy.body, entry.placeholders)).toEqual([]);
      if (entry.channel === "email") {
        expect(copy.subject, `${entry.key}.email needs a subject`).toBeDefined();
        if (copy.subject !== undefined) {
          expect(unknownPlaceholders(copy.subject, entry.placeholders)).toEqual([]);
        }
      } else {
        expect(copy.subject).toBeUndefined();
      }
    }
  });
});

describe("Khakhra House pack — journal", () => {
  it("is empty and the feature is off, so /journal never links or renders", () => {
    expect(brand.journal).toEqual([]);
    expect(brand.profile.features.journal).toBe(false);
    expect(brand.profile.features.locator).toBe(false);
    const hrefs = [...brand.profile.nav.primary, ...brand.profile.nav.footerCompany].map((l) => l.href);
    expect(hrefs.some((h) => h.startsWith("/journal") || h.startsWith("/locator"))).toBe(false);
  });
});

describe("Khakhra House pack — copy", () => {
  it("writes the khakhra brand's own words (the vertical is baked into the pack)", () => {
    expect(brand.profile.key).toBe("khakhra");
    expect(brand.copy.titleTagline).toBe("Hand-Roasted Khakhra");
    expect(brand.copy.invoiceTagline).toBe("Hand-roasted khakhra");
    expect(brand.copy.home.hero.headline(null)).toBe("Thin, crisp and roasted by hand.");
    expect(brand.copy.home.hero.headline("Methi Khakhra")).toBe("Methi Khakhra: roasted this week.");
    expect(brand.copy.home.hero.cta("Methi Khakhra")).toBe("Try Methi Khakhra");
    expect(brand.copy.home.process.steps.map((s) => s.title)).toEqual(["Knead", "Roll", "Roast", "Pack"]);
    expect(brand.copy.home.trust.signals.map((s) => s.icon)).toEqual(["flame", "box", "shield"]);
    expect(brand.copy.footer.copyrightHolder).toBe("Khakhra House");
    expect(brand.copy.newsletter.label("10% off your first order")).toBe("Get 10% off your first order");
    expect(brand.copy.shop.categoryMetaDescription("Plain & Everyday")).toContain("Shop Plain & Everyday");
    expect(brand.legal.foodProducts.body).toContain("non-returnable once opened");
    expect(brand.legal.returns.damagedTrigger).toMatch(/damaged, crushed, stale/);
    expect(brand.email.copy.fulfilment.deliveredLede("Khakhra House", "pack")).toContain("every pack");
  });

  it("never promises a cold chain, insulation, ice packs or melting — anywhere", () => {
    const leaves = packText();
    expect(leaves.length).toBeGreaterThan(150);
    for (const banned of ["cold", "ice pack", "insulat", "melt", "chocolate", "refrigerat"]) {
      // "refrigerat…" may only appear to say it is NOT needed.
      const hits = leaves.filter(
        (s) => s.includes(banned) && !(banned === "refrigerat" && /no(?:t|ne)? (?:need|required|use)|does not need refrigeration|no refrigeration|not need refrigeration|will only make it damp/.test(s)),
      );
      expect(hits, `pack says "${banned}"`).toEqual([]);
    }
    const icons: readonly string[] = brand.copy.home.trust.signals.map((s) => s.icon);
    expect(icons).not.toContain("snowflake");
  });

  it("carries the email accent and literal OG / icon colours", () => {
    expect(email.theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(email.theme.accent).toBe("#b4532a");
    expect(og.background).toContain("#8C3B1C");
    expect(icon.ink).toBe("#FFF3DC");
    expect(brand.fontAttribution).toBeNull();
  });

  it("links only to root-relative routes", () => {
    const links = [
      brand.copy.home.bestSellers.emptyCta,
      brand.copy.home.story.cta,
      brand.copy.home.gifting.cta,
      brand.copy.about.closing.primary,
      brand.copy.about.closing.secondary,
      brand.copy.support.closing.primary,
      brand.copy.support.closing.secondary,
      brand.copy.journal.index.closing.primary,
      brand.copy.journal.index.empty.cta,
      brand.copy.journal.article.closing.secondary,
      brand.copy.notFound.primary,
      brand.copy.notFound.secondary,
    ];
    for (const link of links) expect(link.href).toMatch(/^\/[A-Za-z0-9\-._~/?=&]*$/);
    // Gifting shortcuts point at the brand's own gift category slug.
    expect(brand.copy.home.gifting.cta.href).toBe("/shop?category=gift-packs");
  });
});
