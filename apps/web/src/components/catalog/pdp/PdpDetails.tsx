"use client";

import { useId, useState, type ReactNode } from "react";
import { formatPaise } from "@kakoa/core";
import { cx } from "@kakoa/ui";

export interface PdpReview {
  id: string;
  author: string;
  rating: number;
  title: string | null;
  body: string;
  dateIso: string;
}

export interface PdpDetailsProps {
  /** Admin-authored copy — rendered as text nodes only (XSS rule, spec §6). */
  description: string;
  /** "What you'll get" copy (attributes.whatYoullGet) or a derived fallback. */
  whatYoullGet: string;
  /** Shipping accordion — per-product override (attributes.shipping) or settings. */
  shippingInfo: string | null;
  freeShippingThresholdPaise: number | null;
  giftWrapFeePaise: number | null;
  codEnabled: boolean;
  /** Ingredients & nutrition accordion (FSSAI-required for packaged food). */
  ingredients: string;
  allergens: string;
  nutritionFacts: Record<string, string> | null;
  /** Product information (India Legal Metrology + FSSAI) — folded into the
   *  Ingredients & nutrition accordion (no separate "Product details" section). */
  isVeg: boolean;
  netQuantities: string;
  countryOfOrigin: string;
  shelfLifeDays: number | null;
  storageInstructions: string | null;
  fssaiLicense: string;
}

/** FSSAI square veg / non-veg mark (green = veg, brown = non-veg). */
function VegMark({ isVeg }: { isVeg: boolean }): ReactNode {
  return (
    <span
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      className={cx(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center border-2 bg-cream",
        isVeg ? "border-success" : "border-cocoa",
      )}
    >
      <span
        aria-hidden="true"
        className={cx("h-2 w-2 rounded-pill", isVeg ? "bg-success" : "bg-cocoa")}
      />
    </span>
  );
}

/** Chevron that rotates when its accordion section is open. */
function Chevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(
        "shrink-0 text-espresso transition-transform duration-[var(--duration-base)] ease-brand motion-reduce:transition-none",
        open && "rotate-180",
      )}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** A single collapsible row — LCC-style: big serif title + chevron, hairline. */
function AccordionItem({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}): ReactNode {
  const panelId = useId();
  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 py-3.5 text-left font-display text-[19px] leading-tight text-ink transition-colors hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-[21px]"
        >
          {title}
          <Chevron open={open} />
        </button>
      </h3>
      {open ? (
        <div id={panelId} className="animate-[kk-rise_.28s_var(--ease-entrance)] pb-6">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Compliance / product-information key-value row. */
function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line-soft py-2.5 last:border-0 font-body text-[14.5px]">
      <span className="flex items-center gap-2 text-ink-muted">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * PDP details — Lake-Champlain-style accordion. Order: Product Description ·
 * What You'll Get · Ingredients & nutrition (with the India compliance block) ·
 * Shipping. Product Description is open by default; each section toggles
 * independently. Reviews live in their own section at the bottom of the page.
 */
export function PdpDetails({
  description,
  whatYoullGet,
  shippingInfo,
  freeShippingThresholdPaise,
  giftWrapFeePaise,
  codEnabled,
  ingredients,
  allergens,
  nutritionFacts,
  isVeg,
  netQuantities,
  countryOfOrigin,
  shelfLifeDays,
  storageInstructions,
  fssaiLicense,
}: PdpDetailsProps): ReactNode {
  const [open, setOpen] = useState<Record<string, boolean>>({
    description: true,
  });
  const toggle = (id: string): void =>
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  // Guard against malformed nutrition data (e.g. a value that stringified to
  // "[object Object]" from a bad admin save) — never render coerced junk.
  const nutritionEntries =
    nutritionFacts !== null
      ? Object.entries(nutritionFacts).filter(([, v]) => {
          const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
          return s !== "" && s !== "[object Object]";
        })
      : [];

  return (
    <section aria-label="Product information" className="mt-14 border-t border-line">
      {/* 1 — Product Description */}
      <AccordionItem
        title="Product Description"
        open={open.description ?? false}
        onToggle={() => toggle("description")}
      >
        <p className="max-w-[62ch] font-body text-[15.5px] leading-[1.75] whitespace-pre-line text-ink-soft">
          {description}
        </p>
      </AccordionItem>

      {/* 2 — What You'll Get */}
      <AccordionItem
        title="What You'll Get"
        open={open.whatYoullGet ?? false}
        onToggle={() => toggle("whatYoullGet")}
      >
        <p className="max-w-[62ch] font-body text-[15.5px] leading-[1.75] whitespace-pre-line text-ink-soft">
          {whatYoullGet}
        </p>
      </AccordionItem>

      {/* 3 — Ingredients & nutrition (incl. India compliance block) */}
      <AccordionItem
        title="Ingredients & nutrition"
        open={open.ingredients ?? false}
        onToggle={() => toggle("ingredients")}
      >
        <div className="flex max-w-[560px] flex-col gap-6">
          <div>
            <h4 className="mb-2 font-body text-[14px] font-semibold text-ink">
              Ingredients
            </h4>
            <p className="mb-5 font-body text-[15px] leading-[1.7] text-ink-soft">
              {ingredients || "—"}
            </p>
            {allergens !== "" ? (
              <>
                <h4 className="mb-2 font-body text-[14px] font-semibold text-ink">
                  Allergens
                </h4>
                <p className="font-body text-[15px] leading-[1.7] text-ink-soft">
                  {allergens}
                </p>
              </>
            ) : null}
          </div>
          {nutritionEntries.length > 0 ? (
            <div className="h-fit rounded-[16px] border border-line-soft bg-cream-2 p-5">
              <h4 className="mb-3 font-mono text-[12px] font-semibold tracking-[0.12em] text-espresso uppercase">
                Nutrition · per 30 g
              </h4>
              <div className="flex flex-col">
                {nutritionEntries.map(([key, value]) => (
                  <DetailRow key={key} label={key} value={value} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Product information — India Legal Metrology / FSSAI (kept, folded here). */}
        <div className="mt-8 max-w-[540px] border-t border-line-soft pt-6">
          <div className="mb-3 font-mono text-[11px] font-semibold tracking-[0.14em] text-espresso uppercase">
            Product information
          </div>
          <DetailRow
            label={isVeg ? "Vegetarian" : "Non-vegetarian"}
            value="MRP inclusive of all taxes"
            icon={<VegMark isVeg={isVeg} />}
          />
          <DetailRow label="Net quantity" value={netQuantities} />
          <DetailRow label="Country of origin" value={countryOfOrigin} />
          {shelfLifeDays !== null ? (
            <DetailRow label="Shelf life" value={`${shelfLifeDays} days`} />
          ) : null}
          {storageInstructions !== null ? (
            <DetailRow label="Storage" value={storageInstructions} />
          ) : null}
          <DetailRow
            label="FSSAI Lic. No."
            value={fssaiLicense !== "" ? fssaiLicense : "Licensed"}
          />
        </div>
      </AccordionItem>

      {/* 4 — Shipping */}
      <AccordionItem
        title="Shipping"
        open={open.shipping ?? false}
        onToggle={() => toggle("shipping")}
      >
        {shippingInfo !== null ? (
          <p className="max-w-[62ch] font-body text-[15px] leading-[1.7] whitespace-pre-line text-ink-soft">
            {shippingInfo}
          </p>
        ) : (
          <ul className="max-w-[62ch] space-y-2.5 font-body text-[15px] leading-[1.6] text-ink-soft">
            <li>Ships cold &amp; insulated — packed with ice packs so every piece arrives perfect.</li>
            <li>
              {freeShippingThresholdPaise !== null
                ? `Free shipping on orders over ${formatPaise(freeShippingThresholdPaise)}.`
                : "Flat-rate insulated delivery across India."}
            </li>
            <li>Dispatched in 1–2 business days.</li>
            <li>
              {giftWrapFeePaise !== null
                ? `Gift wrap available at checkout for ${formatPaise(giftWrapFeePaise)}.`
                : "Gift wrap available at checkout."}
            </li>
            {codEnabled ? <li>Cash on Delivery available.</li> : null}
          </ul>
        )}
      </AccordionItem>
    </section>
  );
}
