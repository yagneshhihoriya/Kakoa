# KAKOA — Prioritized Improvement Backlog

> Grounded review of the actual codebase across 5 dimensions (storefront UX/conversion, admin UX,
> performance, trust/polish/a11y, reliability). Each item: **impact / effort**, what & why, files.
> The app is already well-built — these SHARPEN it. Ordered by value, not by dimension.

---

## 🥇 Do-now quick wins (high value, small effort) — biggest bang per hour

| # | Item | Impact/Effort | Why it matters |
|---|---|---|---|
| 1 | **Fix the brand-name inconsistency** — the Razorpay pay modal says **"Kakoa"**, the site says **"Kakao"**, emails/invoice say **"KAKAO"** | HIGH / S | A customer who browses "Kakao" then sees "Kakoa" on the **payment sheet** wonders if the charge is legit — a trust leak at the worst moment. Route everything through `BRAND` in `lib/seo/site.ts`. `CheckoutClient.tsx:545`, `BrandMark.tsx:70`, per-page titles |
| 2 | **Remove the fake "4.9 · 2,400+ reviews"** hero claim while every PDP shows "No reviews yet" | HIGH / S | Misleading + ASCI/Consumer-Protection exposure; shopper clicks through and sees zero reviews. Bind to the real aggregate or use a non-numeric trust cue. `(storefront)/page.tsx:117-145` |
| 3 | **Make search actually search** — the overlay caps at 8 hits, Enter does nothing, no "view all" | HIGH / S | `/shop?q=` already works; the overlay is a dead-end. Wire Enter + a "View all N results →" row. Direct conversion win. `SearchOverlay.tsx` |
| 4 | **Fix the Razorpay webhook failed-capture bug** — a duplicate delivery no-ops without checking status | HIGH / S | If `confirmPayment` throws once, the paid order is stranded `pending_payment` **forever** (we ack 200, redelivery sees "duplicate"). On dupe, re-run the idempotent confirm if the row isn't `processed`. `webhooks/razorpay/route.ts` |
| 5 | **Add a "Skip to content" link** (WCAG 2.4.1) | MED / S | Keyboard/SR users tab through ~7 nav links on every page. `(storefront)/layout.tsx` |
| 6 | **Emit `theme-color` meta + enrich Organization JSON-LD** (contactPoint, sameAs, address) | MED / S | Mobile address-bar tint + knowledge-panel eligibility. `app/layout.tsx` |
| 7 | **Give transactional emails a real footer** (support contact, address, FSSAI) | MED / S | Today's email footer has no support path + hurts deliverability. `lib/email/templates.ts` |
| 8 | **Expose the COD/Prepaid filter on Orders** (already wired in code, no UI) + fix the search-drops-filter bug | MED / S | COD confirmation is a core daily workflow; the filter is URL-only today. `admin/(shell)/orders/page.tsx` |
| 9 | **Confirm before deactivating a staff member** (one misclick signs them out) | MED / S | Inconsistent with the rest of admin (which confirms). `StaffManager.tsx` |

---

## 🔴 Important — worth prioritizing even though bigger

| # | Item | Impact/Effort | Why it matters |
|---|---|---|---|
| 10 | **Build the reconciliation sweep** — the code references it everywhere but **it doesn't exist** | HIGH / M | No cron/sweep means: a paid order whose confirm throws stays `pending_payment` forever; refunds stuck `initiated` never retry; abandoned prepaid orders hold stock indefinitely (silent oversell starvation). Ship a Vercel-Cron/Inngest job: re-confirm captured-unconfirmed payments, re-drive stuck refunds, release stock past the hold window. |
| 11 | **Publish the 4 legal pages** — privacy/terms/shipping/refund are "being finalised" placeholders **but the login sheet already collects consent to them** + sitemap indexes them | HIGH / L | Razorpay onboarding + Consumer-Protection Rules 2020 require these. Consent to non-existent docs is a real exposure. Ship real copy (or gate the links). |
| 12 | **Adopt `next/image` for product imagery** — every image is a raw `<img>`, zero optimization | HIGH / M | For a brand where photography *is* the product, mobile shoppers download desktop-sized originals (no AVIF/WebP/srcset) — the biggest LCP/bandwidth cost. Switch storefront images to `next/image` + `images.remotePatterns`. |
| 13 | **Wire the dead admin notification bell into a live "needs attention" queue** | HIGH / M | The bell has no onClick/badge; every page is `force-dynamic` with no polling, so a new order / COD-to-confirm / pending review is invisible until you navigate + refresh. Turns admin from pull → push. `layout.tsx`, `metrics.ts` |
| 14 | **Add tests on the money paths** — every test today is pure-helper; **zero** cover placeOrder / confirmPayment / refundPayment / cancelOrder / the webhook | HIGH / M | The highest-risk code (idempotency, over-refund guard, oversell rejection) has no regression signal. Add integration tests over a transactional test DB. |

---

## 🟡 Medium — solid UX/robustness upgrades

| # | Item | I/E | Files |
|---|---|---|---|
| 15 | **Sticky mobile "Add to bag" bar on the PDP** (CTA scrolls off once buyer reads content) | HIGH / M | `PdpPurchasePanel.tsx` |
| 16 | **Sortable admin list columns** (Customers by spend, Inventory by stock, Orders by total) | HIGH / L | `admin/**/*.ts` + pages |
| 17 | **Wishlist heart silently no-ops for signed-in users** (+ aria-label lies) | MED / M | `WishlistHeartButton.tsx` |
| 18 | **Checkout Step 1 "Continue" needs two presses** when serviceability hasn't run | MED / M | `CheckoutClient.tsx` |
| 19 | **Focus-trap/ESC/scroll-lock on the money-critical checkout modals** (price-changed, sold-out, payment-fail) | MED / M | reuse `useOverlay.ts` |
| 20 | **Webhook confirm skips the captured-amount assertion** the verify fast-path enforces | MED / S | `webhooks/razorpay/route.ts` |
| 21 | **Add the rate-limit gate** the code references but that doesn't exist (write/verify endpoints unthrottled) | MED / M | `auth/rate-limit.ts` + checkout routes |
| 22 | **Bulk actions** on repetitive queues (Reviews approve/reject, Orders mark-packed) | MED / M | `ReviewQueue.tsx` |
| 23 | **Responsive/collapsible admin sidebar** (fixed 248px eats 2/3 of a phone) | MED / M | `AdminSidebar.tsx` |
| 24 | **Visible keyboard-focus styling in admin** (1 focus-visible hit repo-wide) | MED / M | admin buttons |
| 25 | **Real empty states with a create CTA** (distinguish "no results" from "nothing yet") | MED / S | admin list pages |
| 26 | **Operator visibility/alerting for silently-failed money side-effects** (stuck refunds, failed webhooks) | MED / M | a "Reconciliation/Health" admin panel — pairs with #10 |
| 27 | **OG/Twitter share image** — every shared link is currently a blank card | HIGH / M | `app/opengraph-image.tsx` (I rated M; it's a strong shareability win) |
| 28 | **Prioritize the LCP image** (PDP main + first shop cards are lazy-loaded) | MED / S | `PdpGallery.tsx`, `ProductCard.tsx` |

---

## 🔵 Lower / longer-term (track, not urgent)

| # | Item | I/E |
|---|---|---|
| 29 | Align loading skeletons to real layout (CLS mismatch despite "CLS 0" comments) | LOW / S |
| 30 | Collapse the home category-count N+1 into one grouped query | LOW / S |
| 31 | Extract shared `<AdminTable>/<Pagination>/<SearchBar>` primitives + unify the Search button style + add "clear search" | LOW / M |
| 32 | Persist a Shiprocket webhook event ledger (dedupe/audit, like Razorpay) | LOW / S |
| 33 | Admin dark mode (tokenize the hardcoded palette first) | LOW / L |

---

## Suggested sequencing
1. **Quick-win batch (#1–9)** — mostly S effort, several are trust/conversion wins. A single afternoon.
2. **Money reliability (#4 → #10 → #26 → #14 → #20 → #21)** — the sweep + webhook + tests harden the most important code.
3. **Perf + share (#12 → #27 → #28)** — image optimization + shareable links.
4. **Admin efficiency (#13 → #8 → #16 → #22 → #23 → #25)** — daily-operator wins.
5. **Legal (#11)** — before public launch.
6. The rest as polish.
