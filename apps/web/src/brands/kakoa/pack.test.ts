import { describe, expect, it } from "vitest";
import { brand } from "./index";
import type { NotificationCopy, NotificationsCopy } from "../contract";
import { TEMPLATE_CATALOG, unknownPlaceholders } from "@/lib/admin/notification-catalog";
import type { CompanyInfo } from "@/lib/catalog/queries";

/** The pack's notification copy read through the contract type (widened: `subject` optional). */
const NOTIFICATIONS: NotificationsCopy = brand.copy.notifications;

/**
 * The KAKOA pack's CONTENT half: the typecheck proves every block exists
 * (`satisfies BrandPack`); these tests prove the data is coherent — the FAQ
 * interpolates the live company values, the notification defaults only use
 * placeholders the catalog allows, the journal is well-formed, and the pack
 * carries the brand's own words (so a second pack cannot share them by accident).
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

describe("KAKOA pack — FAQ", () => {
  it("interpolates contact details, fees, COD and the policy SLAs from the company info", () => {
    const faq = brand.faq(COMPANY);
    const text = faq.flatMap((g) => g.items.map((i) => `${i.q}\n${i.a}`)).join("\n");
    expect(faq.map((g) => g.category)).toEqual([
      "Orders & shipping",
      "Storage & freshness",
      "Returns & refunds",
      "Gifting",
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
    expect(text).not.toMatch(/48 hours|5–7 business|1–2 business|2–7 business/);
  });

  it("drops the FSSAI parenthetical and says prepaid-only when those settings are absent", () => {
    const faq = brand.faq({ ...COMPANY, fssai: "", codEnabled: false, freeShippingThresholdPaise: null });
    const text = faq.flatMap((g) => g.items.map((i) => i.a)).join("\n");
    expect(text).not.toContain("FSSAI Lic. No.");
    expect(text).toContain("prepaid-only");
    expect(text).toContain("We offer free shipping on eligible orders");
  });
});

describe("KAKOA pack — notification defaults", () => {
  it("every default subject/body uses only the placeholders the catalog allows", () => {
    for (const entry of TEMPLATE_CATALOG) {
      const copy: NotificationCopy | undefined =
        NOTIFICATIONS[`${entry.key}.${entry.channel}` as keyof NotificationsCopy];
      expect(copy, `${entry.key}.${entry.channel}`).toBeDefined();
      if (copy === undefined) continue;
      expect(unknownPlaceholders(copy.body, entry.placeholders)).toEqual([]);
      if (copy.subject !== undefined) {
        expect(unknownPlaceholders(copy.subject, entry.placeholders)).toEqual([]);
        expect(entry.defaultSubject).toBe(`${copy.subject}${brand.profile.email.subjectSuffix}`);
      }
      if (entry.channel === "sms") {
        expect(entry.defaultBody).toBe(`${brand.profile.email.smsPrefix}${copy.body}`);
      } else {
        expect(entry.defaultBody).toBe(copy.body);
      }
    }
  });
});

describe("KAKOA pack — journal", () => {
  it("has unique kebab-case slugs, fixed ISO dates and token-only cover tones", () => {
    const slugs = brand.journal.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(brand.journal.length).toBeGreaterThan(0);
    for (const article of brand.journal) {
      expect(article.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(article.dateIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.coverTone).toMatch(/^from-[a-z0-9-]+ to-[a-z0-9-]+$/);
      expect(article.coverTone).not.toMatch(/#/);
      expect(article.body.length).toBeGreaterThan(0);
    }
    expect(brand.profile.features.journal).toBe(true);
  });
});

describe("KAKOA pack — copy", () => {
  it("writes the chocolate brand's own words (the vertical is baked into the pack)", () => {
    expect(brand.copy.titleTagline).toBe("Small-Batch Chocolate");
    expect(brand.copy.home.hero.headline(null)).toBe("Chocolate worth slowing down for.");
    expect(brand.copy.home.hero.headline("Midnight 72% Dark")).toBe("Midnight 72% Dark: our house dark.");
    expect(brand.copy.home.hero.cta("Midnight 72% Dark")).toBe("Discover Midnight 72% Dark");
    expect(brand.copy.footer.copyrightHolder).toBe("KAKOA Chocolates");
    expect(brand.copy.newsletter.label("15% off your first box")).toBe("Get 15% off your first box");
    expect(brand.copy.shop.categoryMetaDescription("Bars")).toContain("Shop Bars");
    expect(brand.legal.returns.damagedTrigger).toContain("melted");
    expect(brand.email.copy.fulfilment.deliveredLede("KAKOA", "piece")).toContain("every piece is a delight");
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
  });
});
