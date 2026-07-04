# KAKOA — Order Cancellation & Return / Refund Policy

**Design document · research + recommendation · v1 (2026-07-04)**
**Status: PROPOSAL — awaiting sign-off. No code will change until the decisions in §0 are approved.**

> This document does three things: (1) audits what KAKOA already has, (2) validates it against how the market actually operates (Indian marketplaces, quick-commerce, premium chocolate brands, plus the legal/food-safety frame), and (3) proposes a concrete, launch-ready policy + the plan to build the missing pieces. Your hypothesis — *"no cancellation or return once shipped, for food-safety, product-integrity and logistics reasons"* — is **confirmed by both the research and our own architecture**, with two important refinements: (a) a *pre-dispatch cancellation* window that is generous and self-serve, and (b) a *post-delivery refund/replacement* path (not a physical "return") for damaged / wrong / melted / spoiled goods. Both already exist in our schema and specs; the work is to finish, formalize, and turn them on.

---

## §0 — Decisions that need YOUR sign-off (read this first)

Everything else in this doc is my recommendation. These are the business calls only you can make. My recommendation is in **bold**; the rationale is in the linked section.

| # | Decision | Options | My recommendation | Rationale |
|---|---|---|---|---|
| **D1** | When does self-serve cancellation stop? | (a) At `packed` (current) · (b) earlier, at `confirmed` · (c) allow "request cancel" even after shipping | **(a) Keep: cancellable until `packed`; hard stop after.** | §5. Matches every Indian player ("free before dispatch, impossible after"). Our GST invoice is minted at `packed`, which is the natural, defensible cutoff. |
| **D2** | "Change of mind" **returns** on delivered chocolate? | (a) Reject — pre-dispatch cancel only · (b) Accept within N days | **(a) Reject.** Change-of-mind is served by the pre-dispatch cancel window, not by returning food. | §6.2. Universal across Indian food/grocery; FSSAI cold-chain + tamper rules make delivered food non-recirculable. Legal under CP E-Commerce Rules 2020 **if disclosed**. |
| **D3** | Post-delivery **report window** for damage/quality | (a) 24h (tight, Indian-competitor norm) · (b) 72h · (c) 7 days (keep schema) | **(c) Keep the 7-day file window (already in our schema), photo required, no hard sub-gate.** | §6.3. Research shows Indian competitors are *tighter* (Smoor ~2h, Royce/Entisi/La Folie 24h) but the premium leaders win on generosity (Paul And Mike "no questions," Godiva US/Amazon 30d). 7 days is more generous than our competitors, matches our committed schema, and leans on photo + serial-refunder flags for fraud control rather than a punitive clock. A photo can be taken on delivery day and uploaded any time in the window. |
| **D4** | Who bears **melt-in-transit** (heat damage)? | (a) Brand refunds/replaces melted goods · (b) Disclaim all heat damage · (c) Hybrid: brand covers transit-melt, customer bears "left in the sun / no one home" | **(c) Hybrid.** Brand owns melt that happens *in our custody / in transit*; customer owns melt after a **failed delivery they caused** (not home, refused, wrong address). | §6.4 + §7. This is THE chocolate-specific risk in India. Mitigate operationally (cold-chain, seasonal expedited-only, checkout heat notice) rather than by refusing legitimate melt claims. |
| **D5** | **Summer shipping** posture | (a) Ship year-round, absorb melt risk · (b) Seasonal guardrails (expedited-only + insulated packaging + ship early-week in hot months) · (c) Pause dispatch to extreme-heat pincodes on peak days | **(b) now, (c) as a later refinement.** | §7. Paul And Mike (India) ships air + ice-gel + Blue Dart-only with a no-questions refund; Raaka/Davis ship Mon–Wed in heat. Proven playbook. |
| **D6** | **COD refund** rail | (a) Manual bank collection + finance payout · (b) Razorpay **Payout Links** (customer self-enters bank/UPI, OTP-verified) | **(b) Payout Links.** | §6.5. RBI rules forbid COD refunds into a prepaid wallet; money must go to a bank/UPI. Payout Links cut the 5–7 day manual flow to minutes and avoid us storing raw bank details. |
| **D7** | **RTO refund** rule (parcel returned undelivered) | Per payment mode | **COD RTO → no refund owed** (nothing was paid; we absorb shipping). **Prepaid RTO → refund product value; shipping fee non-refundable** (service was rendered), offer reship instead. | §7. No published industry standard — this is a policy choice; the recommendation is the common, defensible one. |
| **D8** | **Restocking fee / return shipping** charge to customer | (a) None · (b) Fee | **(a) None.** For quality claims there is no physical return anyway; for `wrong_item` the fault is ours. | §6. Charging a fee on a food-safety refund reads as hostile and is rarely worth the goodwill cost at our AOV. |

If you approve these as-is, I will implement §10 exactly. If you want to change any, tell me which and I will re-plan around it.

---

## §1 — Deliverable 1: Current order lifecycle & cancellation analysis

### 1.1 The state machine we already run (`packages/core/src/order-state-machine.ts`)

11 states; cancellation is modelled as a transition **→ `cancelled`**, gated by an actor allow-list. This is the ground truth today:

```
pending_payment ──▶ confirmed ──▶ packed ──▶ shipped ──▶ out_for_delivery ──▶ delivered ●
      │                 │            │           │                │
      ├─▶ payment_failed │            │           └─▶ rto_initiated ──▶ rto_delivered ●
      │       │          │            │                   │
      └───────┴──────────┴────────────┴───▶ cancelled ●   └─▶ out_for_delivery (re-attempt)
  cod_pending_confirmation ─▶ confirmed / cancelled
● = terminal
```

| From state | Cancellable? | Who can cancel | Money state | On cancel |
|---|---|---|---|---|
| `pending_payment` | ✅ | customer, system (30-min expiry job) | nothing captured | restock + close |
| `payment_failed` | ✅ | customer, system (24h job) | nothing captured | restock + close |
| `cod_pending_confirmation` | ✅ | customer, admin, system (48h-unreachable) | nothing captured | restock + close |
| `confirmed` | ✅ | customer, admin | prepaid captured / COD none | restock + **auto-refund if prepaid** |
| `packed` | ⚠️ admin only | admin (rare) | as above | restock + refund; GST invoice already minted |
| `shipped` | ❌ **no cancel edge exists** | — | — | forward-only (→ OFD / delivered / RTO) |
| `out_for_delivery` | ❌ **no cancel edge** | — | — | → delivered / RTO |
| `delivered` | ❌ terminal | — | settled | **returns handled separately, not as a state transition** |
| `rto_initiated` / `rto_delivered` | n/a | carrier/system | reconcile | RTO refund per §7 (D7) |

**Finding:** Our architecture *already enforces your hypothesis at the type level.* There is **no cancellation edge out of `shipped` or `out_for_delivery` at all** — not even for admins. `assertTransition(shipped → cancelled)` throws `IllegalTransitionError` → HTTP 422 `INVALID_TRANSITION`. The customer-cancellable set is exactly `{pending_payment, payment_failed, cod_pending_confirmation, confirmed}`. `packed` is admin-only because the **GST tax invoice is assigned at `packed`** — cancelling after that needs a credit-note, so it is deliberately not self-serve.

### 1.2 The cancellation code we already run (`apps/web/src/lib/orders/cancel.ts`)

One `SELECT … FOR UPDATE` transaction: lock order → `assertTransition(→cancelled)` → set `cancelled/cancelled_at/cancel_reason` → **restock every line idempotently** (`inventory_adjustments`, reason `order_cancelled`, partial-unique cause index so a replay can't double-restock) → append `order_status_history` (actor = customer or guest-via-JWT) → **if a `captured` prepaid payment exists, insert a `refunds` row** (`status='initiated'`, `destination='original_method'`) for the payments worker → best-effort cancellation email after commit. COD cancel captures nothing, so no refund row. Auth: session-owner **or** guest tracking JWT; the read-only `access_token` is deliberately **not** accepted for a mutation.

### 1.3 What is missing today (the honest gap list)

1. **Returns flow is specced but not built.** `docs/modules/returns-refunds.md` + the `return_requests` / `return_request_items` tables exist; there are **no endpoints, no customer UI, no admin queue** yet.
2. **Refund worker is a stub.** `cancel.ts` writes a `refunds` row with a `TODO` — the actual Razorpay Refunds API call, COD Payout-Link disbursement, and status reconciliation do not exist yet.
3. **No `changed_mind` policy guard** — the enum permits it; policy (D2) must decide.
4. **No melt / summer-shipping operational policy** (D4/D5) and no checkout heat notice.
5. **No customer-facing policy page** — `/legal/refund` and `/legal/shipping` are stubs.
6. **No RTO refund reconciliation** (D7).

---

## §2 — Deliverable 2: Industry research (what the market actually does)

Full citations are preserved in the research appendix (`§11`). Highlights:

### 2.1 Indian marketplaces & quick-commerce (food/perishable behaviour)

- **Amazon India** — free cancel **before dispatch**; groceries/food **non-returnable by default**; damaged/wrong/spoiled → **full refund/replacement, report within 5 days, usually no pickup**; refund to source (prepaid) or **bank via NEFT** (Pay-on-Delivery); source refunds 2–7 business days. [[src](https://www.amazon.in/gp/help/customer/display.html?nodeId=202111910)]
- **Flipkart / Supermart** — free cancel **before dispatch**, some categories charge a fee after; grocery is **refund-only in tight 1–3 day windows**; packaged food on the **non-returnable list**; **product-page policy overrides** the general one. [[src](https://www.flipkart.com/pages/returnpolicy)]
- **BigBasket** — **no-questions return/refuse at the doorstep**; perishables reportable **within 48h with photos** → replace/refund; F&B **non-returnable**; refund defaults to **bbWallet**, source refund only on explicit request. [[src](https://www.bigbasket.com/returns-refund-policy-44003/)]
- **Blinkit / Zepto / Instamart** — cancellable only in a **seconds-to-minutes** window (before packing / seller acceptance); delivered items **non-returnable except damaged/wrong/expired**; report **same-day to ~24–72h with photo**; COD refunds to bank/gift-card, prepaid to source. Instamart's **100%-cancel-fee-after-packing** is being challenged as an unfair trade practice — a cautionary example. [[Zepto](https://www.zepto.com/s/terms-of-service)]

### 2.2 Premium chocolate & confectionery brands

Every premium chocolate brand studied — Western and Indian — converges on the **same two-part rule: chocolate is non-returnable (perishable / final sale), with a single exception for damaged / wrong / missing / melted goods on arrival, resolved on photo proof, replacement-first, usually without a physical return.** The variation is only in the *report window* and *how melt is handled*.

**Western brands (final-sale + quality guarantee):**
- **Lindt (US)** — *"we do not accept any product returns or exchanges. All sales are final."* A **14-day quality guarantee** replaces returns; **photos required**; one remedy per household. Strong hot-weather ops: *"ships on ice as needed,"* withdraws Standard/Ground to hot states and auto-upgrades to 2nd-Day/Overnight, customer duty to *"retrieve and open… as soon as possible."* [[Returns](https://www.lindtusa.com/returns) · [Shipping](https://www.lindtusa.com/shipping-policy-delivery-information)]
- **Godiva (US/UK)** — *"Returns and refunds are not offered"* (US); UK cites the **Consumer Contracts Regulations 2013 perishable exemption**. Damage remedy is **reship/replace, not cash** — report within **30 days (US) / 14 days (UK)** with **photos of item + internal/external packaging + delivery label**. Kills Standard shipping to ~22 hot states. [[US](https://www.godiva.com/return-policy/returnsPolicy.html) · [UK](https://godivachocolates.co.uk/pages/delivery-and-returns)]
- **Hotel Chocolat (UK)** — **"100% Happiness Guarantee"** (contact-first; refund/replace/gift-card); *"your right to return goods does not apply to perishables, unless faulty"*; **"clear and satisfactory photographic evidence" required**. Holds stock in a **temperature-controlled warehouse until it cools**; US despatches Mon–Wed to avoid hot-truck weekends. [[Guarantee](https://www.hotelchocolat.com/uk/help/our-guarantee.html) · [T&C](https://www.hotelchocolat.com/uk/help/terms-and-conditions.html)]
- **Läderach (US)** — best-in-class **temperature-tiered shipping: >75°F → Second Day Air, >95°F → Next Day Air**, warm-month cooling surcharge, no UPS Ground, ships Mon–Wed. Refund 3–5 business days after warehouse inspection. [[Delivery](https://laderach.com/us-en/delivery-information)]
- **Thorntons (UK)** — perishable-food return refusal under the **Consumer Rights Act 2015**; damaged/opened not accepted *unless* there's a genuine product/delivery issue; no published day-window or heat policy. [[Returns](https://help.thorntons.com/hc/en-gb/articles/21186094163986)]
- **Ferrero** — **no DTC store**; sells via third-party retailers, so returns are governed by Amazon/Walmart/Target, not Ferrero.

**Indian premium D2C (tighter report windows; strong cold-chain):**
- **Paul And Mike** — the beloved benchmark: *"No Questions Asked Refund Policy"*, **thermocol + ice-gel + overnight express**, and the market's most melt-generous line: *"What if chocolate melts? …We shall resend or refund the amount."* Report shortages/damage **on the day of delivery**. [[Policy](https://www.paulandmike.co/pages/shipping-and-return-policy) · [FAQ](https://www.paulandmike.co/pages/faqs)]
- **Royce' India** — strongest perishable clause: *"all of our confections are perishable, therefore, all purchases will be final and non-refundable."* Cancel with **24h lead time before delivery**. Best-in-class cold chain: **insulated bag + ice-gel, dispatched frozen** (defrost 4h before eating). [[Refund](https://royceindia.com/pages/refund-return-policy)]
- **Smoor** — *"not entitled to cancel once you have received confirmation."* Damage reportable **within ~2 hours**, photo may be requested; refund **deducts 20%** (shipping + payment charges); resolution = replacement / 50% refund / 50% store credit. **No published heat policy.** [[Policy](https://smoor.in/pages/refund-cancellation-policy)]
- **Entisi** — report **within 24h**; **thermocol + dry ice + gel packs**; **blocks cities where delivery exceeds ~3–4 days** (melt risk). [[FAQ](https://entisi.com/pages/faqs)]
- **La Folie** — cancel within 24h of order; **store credit only**, no monetary refunds; report damage within 24h. [[Return](https://lafolie.in/pages/return-policy)]

### 2.2b Global grocery marketplaces (refund-without-return norm)

- **Amazon US (Fresh / Whole Foods)** — *"If you receive a damaged, spilled, or otherwise unusable… grocery item, you can request a refund through Your Orders. We won't ask you to return the item."* Window **up to 30 days**; no photo requirement published. [[src](https://www.amazon.com/gp/help/customer/display.html?nodeId=GJ45JL8CMX9QMGSD)]
- **Walmart (Fresh Guarantee)** — refund **or free replacement** on damaged/quality; associate may view but **not take** the item; ~7-day perishable practice (not published verbatim). [[src](https://www.walmart.com/help/article/walmart-standard-return-policy/adc0dfb692954e67a4de206fb8d9e03a)]
- **Instacart** — *"For missing or damaged items, we can issue a refund or credit… up to the amount you paid."* Self-report **within 3 days**, no return for standard items, Instacart chooses refund-vs-credit. [[src](https://www.instacart.com/help/article/returns-policy)]

### 2.3 Baseline platform norms (Shopify) & the cancel-vs-return split

Shopify draws the exact line we already draw: **cancel = pre-fulfillment** (restock, no fee, self-serve windows of 15 min / 1h / 24h / until-fulfillment) vs **return = post-fulfillment** (item must usually ship back; windows 14/30/90 days). **Perishables are set "final sale"**, with a standard **damaged/defective carve-out that refunds/replaces without requiring the item back**. [[src](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns/return-rules)]

### 2.4 Legal & food-safety frame (India)

- **Consumer Protection (E-Commerce) Rules 2020** — must **prominently disclose** cancel/refund/return terms; **no cancellation charge unless the entity bears a similar charge itself**; grievance officer **acknowledges in 48h, resolves in 1 month**; **non-returnable categories are lawful if clearly disclosed.** [[src](https://thc.nic.in/Central%20Governmental%20Rules/Consumer%20Protection%20(E-Commerce)%20Rules,%202020.pdf)]
- **FSSAI** — cold-chain (refrigerated 0–5°C, frozen ≤−18°C), tamper/contamination irreversibility, and the **≥45-days-or-30%-shelf-life-at-delivery** rule all make delivered food **one-way, non-recirculable** — the safety basis for "delivered = non-returnable."
- **RBI** — refunds to **source** for prepaid; **COD refunds must go to a bank account (NEFT/UPI), never a prepaid wallet**; auto-reversal TAT framework carries a **₹100/day penalty** for delays beyond the prescribed window.

---

## §3 — Deliverable 3: Policy comparison & where KAKOA lands

| Dimension | Indian marketplaces | Premium chocolate | Shopify baseline | **KAKOA (proposed)** |
|---|---|---|---|---|
| Cancel before dispatch | Free, self-serve | Free | Self-serve, restock | ✅ **Free, self-serve until `packed`** |
| Cancel after dispatch | Impossible (refuse at door) | Impossible | Not allowed (return only) | ✅ **Impossible — no edge exists** |
| Change-of-mind return (food) | ❌ non-returnable | ❌ non-returnable | ❌ final-sale | ✅ **Rejected (D2)** |
| Damaged/wrong/spoiled | Refund/replace, photo, ~24h–5d | Refund/replace, no-questions | Damaged carve-out, no return | ✅ **Refund/replace on photo, report ≤72h (D3)** |
| Physical pickup | Rare for perishables | No | Only for non-damaged | ✅ **Only for `wrong_item`; none for quality** |
| Melt-in-transit | n/a (not chocolate) | Brand covers / packaging-gated | n/a | ✅ **Hybrid (D4): brand covers transit-melt** |
| COD refund | Bank/NEFT or wallet | n/a | Source | ✅ **Payout Link → bank/UPI (D6)** |
| Prepaid refund | Source, 2–7 days | Source | Source | ✅ **Razorpay source; instant where possible** |
| Restocking fee | Sometimes | No | Optional | ✅ **None (D8)** |

**Verdict:** KAKOA's proposed posture is *dead-center of Indian norms, food-safety-defensible, and CP-Rules-compliant*, while being **more customer-generous than the quick-commerce players** on the two things that matter for a premium brand — a real (72h) reporting window and brand-owned melt coverage.

---

## §4 — Deliverable 4: Recommended business rules (normative)

**BR-1 Cancellation is pre-dispatch only.** Self-serve customer cancel is allowed in `{pending_payment, payment_failed, cod_pending_confirmation, confirmed}`. It becomes admin-only at `packed` (GST invoice minted) and **impossible** from `shipped` onward. *(No code change — this is already true.)*

**BR-2 One-way after dispatch.** Once `shipped`, the only paths are delivery, re-attempt, or RTO. A customer who no longer wants a shipped order may **refuse delivery** (→ RTO) or use the post-delivery flow if it qualifies.

**BR-3 Delivered food is non-returnable for change of mind (D2).** The only post-delivery recourse is a **refund or replacement** for a qualifying defect.

**BR-4 Qualifying defects** = `damaged_or_melted`, `wrong_item`, `quality_issue` (spoiled/foreign-object/off), reported within **72h** and filed within **7 days** of delivery (D3), with **≥1 verified photo** for `damaged_or_melted` / `quality_issue`.

**BR-5 No physical return for quality claims.** `damaged_or_melted` / `quality_issue` resolve on photo evidence — the goods are not collected (food-safety + reverse-logistics cost). **Physical pickup + mark-received + restock applies only to `wrong_item`** (sealed, resalable).

**BR-6 Resolution is refund or replacement**, customer's choice; the brand may downgrade a replacement to a refund if the SKU is out of stock. Replacement = a linked **₹0 order** through normal fulfillment (real stock decrement, AWB, tracking).

**BR-7 Refund rails (D6).** Prepaid → Razorpay refund to **source** (instant where the rail supports it, else 5–7 business days). COD → **Razorpay Payout Link**, customer self-enters + OTP-verifies bank/UPI. **Never** refund COD into a wallet (RBI).

**BR-8 Melt & summer (D4/D5).** Brand covers melt occurring in our custody/transit. Customer-caused failure (not home, refused, wrong address → RTO) is **not** a covered melt claim. Operationally: insulated packaging + expedited-only + early-week dispatch in hot months + a checkout heat notice.

**BR-9 RTO refunds (D7).** COD RTO → no refund (nothing paid). Prepaid RTO → refund product value, retain shipping, offer reship.

**BR-10 Abuse guardrails.** ≤3 open return requests per identity; **≥3 quality-claim refunds per identity auto-flags for owner review**; refunds > ₹2,000 or flagged identities are **owner-only** decisions (staff locked out server-side). COD-refusal RTO history feeds the same risk store as an existing COD trust signal.

**BR-11 Disclosure (CP Rules).** The full policy is published at `/legal/refund` + `/legal/shipping`, linked from checkout and the order emails, with the 72h/7-day windows and melt terms stated plainly.

---

## §5 — Deliverable 5: Status-by-status cancellation matrix

| Order status | Customer self-cancel | Admin cancel | System auto-cancel | Refund owed | Restock | Notes |
|---|---|---|---|---|---|---|
| `pending_payment` | ✅ yes | ✅ | ✅ 30-min expiry | none (uncaptured) | ✅ | payment never completed |
| `payment_failed` | ✅ yes | ✅ | ✅ 24h expiry | none | ✅ | may retry instead |
| `cod_pending_confirmation` | ✅ yes | ✅ decline | ✅ 48h unreachable | none | ✅ | pre-confirmation |
| `confirmed` | ✅ yes | ✅ | — | **prepaid: full auto-refund** · COD: none | ✅ | last self-serve point |
| `packed` | ❌ **no** | ⚠️ yes (rare) | — | prepaid: full refund + credit-note | ✅ | GST invoice minted → admin + credit-note |
| `shipped` | ❌ no | ❌ no edge | — | — | — | refuse-at-door → RTO is the only lever |
| `out_for_delivery` | ❌ no | ❌ no edge | — | — | — | same |
| `delivered` | ❌ (returns instead) | — | — | via return flow only | only `wrong_item` | §6 governs |
| `rto_initiated` / `rto_delivered` | n/a | reconcile | carrier | per BR-9 | on RTO receipt | §7 |
| `cancelled` | terminal | — | — | settled | done | — |

**Customer-visible copy at the cutoff** (replacing today's terse string): *"This order is already packed and on its way to dispatch, so it can't be cancelled online. If it hasn't shipped yet, contact support and we'll try to help. Once delivered, you can report any damage or issue within 72 hours."*

---

## §6 — Deliverable 6: Return / refund policy (post-delivery)

### 6.1 Eligibility gate
Order must be `delivered`; within **7 days** of the delivery scan (IST; fallback to last `shipment_events` timestamp if the scan is missing); no existing open request for that order; identity under the 3-open-request cap.

### 6.2 Reasons & what each does
| Reason | Photo required | Physical return | Default resolution | Accepted? |
|---|---|---|---|---|
| `damaged_or_melted` | ✅ ≥1 | ❌ no | refund or replace | ✅ |
| `quality_issue` (spoiled/off/foreign object) | ✅ ≥1 | ❌ no | refund or replace | ✅ |
| `wrong_item` | optional | ✅ pickup, sealed | replace (or refund) | ✅ |
| `changed_mind` | — | — | — | ❌ **rejected (D2)** — shown only to explain non-eligibility |
| `other` | admin discretion | admin discretion | admin discretion | ⚠️ manual review |

### 6.3 Reporting window (D3)
A return request can be **filed up to 7 days** after the delivery scan (IST), with **≥1 photo** for perishable reasons — the window already committed in our schema, and deliberately more generous than Indian competitors' 24h. Beyond 7 days → `RETURN_WINDOW_CLOSED` shown as a **calm policy screen, not an error toast**, with a support path. (If you prefer to match the tighter Indian-competitor norm, we can drop this to 24–72h — see D3 — but the premium-generous 7 days is my recommendation.)

### 6.4 Melt / damage handling (D4)
`damaged_or_melted` is a **first-class, expected** reason (already in our enum). Brand covers melt in transit → refund/replace on photo. The checkout heat notice + `shipment_events` establish whether a failed delivery (customer-caused) preceded the melt, which is the one carve-out.

### 6.5 Refund execution (D6/BR-7)
- **Prepaid** → Razorpay Refunds API against the captured payment; idempotency key = `refunds.id`; instant where the rail allows, else normal 5–7 business days; track via `refund.processed` webhook; store `provider_refund_id` + UTR.
- **COD** → Razorpay **Payout Link**: customer opens link, OTP-verifies, self-enters bank/UPI; we store only the `payout_reference` (UTR), never raw bank details.
- **Replacement** → linked ₹0 order; if OOS, downgrade to refund with a clear message.

### 6.6 States (already in schema)
`return_status`: `requested → approved → (pickup_scheduled → received →) refunded → closed` | `rejected` | `cancelled`. `refund_status`: `initiated → processed | failed`. `refund_destination`: `original_method | bank_transfer | upi`.

---

## §7 — Deliverable 7: Edge cases

1. **Melt in Indian summer transit** → covered (D4); mitigate with cold-chain + seasonal expedited-only; not a liability we disclaim.
2. **Melt after failed delivery (customer not home / refused)** → not covered; `shipment_events` proves the failed attempt preceded melt.
3. **Partial delivery / one item damaged in a multi-item order** → item-level return (`return_request_items` quantity); refund only the affected line(s).
4. **Prepaid RTO** → refund product value, retain shipping (BR-9); offer reship.
5. **COD RTO** → no refund (nothing paid); log to COD-trust store; repeat offenders flagged.
6. **Race: customer cancels while admin clicks "pack"** → `SELECT … FOR UPDATE` serializes; whichever commits first wins; the loser gets `INVALID_TRANSITION`. *(Already handled in `cancel.ts`.)*
7. **Double-submit refund / double restock** → idempotent via `refunds` unique provider index + `inventory_adjustments` partial-unique cause index.
8. **Refund of a partially-settled Razorpay payment** → Razorpay debits merchant balance/next settlement; our worker only needs the captured `payment_id`.
9. **"Item not received" (INR) fraud on prepaid** → require the delivery scan; escalate disputes with courier POD; flag identity.
10. **Empty-box / switch fraud on `wrong_item` pickup** → sealed-only, admin inspects on `received` before refund; serial flag.
11. **Guest (no account) return** → OTP tracking-token-scoped to that one order; cross-order access returns 404 (no enumeration).
12. **Coupon/discount on a returned line** → refund the **net paid** (post-discount) amount, not MRP; partial returns refund the pro-rata paid value.
13. **Gift-wrap / shipping fee on a full return** → refund product + gift-wrap; shipping refunded only when the whole order is defective/our fault.
14. **Replacement of an out-of-stock SKU** → auto-downgrade to refund with notice.
15. **Refund fails at gateway** (`refund_status=failed`) → retry worker + admin alert; never silently strand.

---

## §8 — Deliverable 8: Customer UX flow

**Cancellation (pre-dispatch):** Order detail / tracking page → "Cancel order" is visible **only** when status ∈ cancellable set → reason select → confirm dialog stating refund handling ("Prepaid: refunded to your original method in 5–7 days" / "COD: nothing was charged") → optimistic "Cancelled" state → email. When not cancellable, the button is replaced by the §5 explanatory copy, not hidden silently.

**Return (post-delivery):** `/account/returns` → "Start a return" (guest: tracking page → "Report a problem") → **order picker lists only `delivered`-within-7-days orders**; empty list *explains why* → pick items + quantities → pick reason → (photos required for damage/quality, uploaded via signed PUT URLs with per-tile progress + retry) → pick refund/replacement → submit → confirmation with request id + expected timeline. `RETURN_WINDOW_CLOSED` → policy screen with support link. COD refund → Payout Link sent by SMS/email.

**Transparency:** every order email + the `/legal/refund` page state the 72h/7-day windows, melt terms, and refund timelines in plain language (CP-Rules disclosure).

---

## §9 — Deliverable 9: Admin workflow

**Cancellations:** appear in order history with actor + reason; prepaid cancels auto-create the refund row; admin dashboard shows a "refunds to process" count.

**Returns queue** (`/admin/returns`, oldest-first): detail view shows EXIF-stripped photos (attachment-served, audited), per-line refundable balance, payment history, **prior-return count + flagged badge**. Actions: **Approve** (`quality/damaged` → straight to refund; `wrong_item` → `pickup_scheduled` → `received` → refund), **Reject** (reason note, customer-notified), **Refund** (owner-only when > ₹2,000 or identity flagged; staff locked out server-side). Every decision, mark-received, and refund initiation lands in `admin_audit_log`.

**Refund worker (to build):** picks up `refunds.status='initiated'` → prepaid: Razorpay Refunds API (idempotency = `refunds.id`) → COD: create Payout Link → on webhook/poll set `processed` + store UTR/`provider_refund_id` → failures set `failed` + alert. Nightly stuck-refund sweep.

---

## §10 — Deliverable 10: Implementation plan (AFTER sign-off)

Phased so the storefront stays launch-solid; each phase ships independently and is verified (typecheck/test/build + live) before the next.

**Phase A — Policy surfaces & cancel polish (small, ship first)**
1. Write real `/legal/refund` + `/legal/shipping` copy from §4/§6 (needs your final numbers from §0).
2. Improve the cancel-not-allowed copy (§5) + add the refund-handling line to the cancel confirm dialog.
3. Add the checkout **heat/summer notice** (D5) as content.
*Verify: build + live copy check. No schema change.*

**Phase B — Refund worker (unblocks real refunds)**
4. Build `initiateRefund()` + the Inngest/worker: Razorpay Refunds API (prepaid), status reconcile via `refund.processed` webhook, nightly stuck sweep. Replace the `TODO` in `cancel.ts`.
5. COD refund via Razorpay **Payout Links** (D6): create-link, OTP self-serve capture, UTR persistence.
*Verify: typecheck/test/build + live prepaid refund (mock provider) + Payout-Link happy path.*

**Phase C — Returns flow (the big missing module)**
6. Endpoints per `returns-refunds.md`: `POST /api/returns`, `POST /api/uploads/return-photos` (signed PUT, magic-byte verify), admin decision + mark-received + refund routes; all rate-limited + owner-gated per BR-10.
7. Customer UI: `/account/returns` + guest entry; admin `/admin/returns` queue.
8. Wire `changed_mind` policy guard (D2) + 72h/7-day window logic (D3) + melt carve-out signal (D4) from `shipment_events`.
*Verify: typecheck/test/build + live E2E (file damage return → approve → refund; wrong_item → pickup → received → refund; window-closed path; guest path).*

**Phase D — Guardrails & seasonal ops**
9. Abuse flags (BR-10), RTO refund reconciliation (BR-9), and (later) seasonal expedited-only + extreme-heat pincode pause (D5c).

I recommend building **A → B → C → D**. Phase A can start immediately on approval; B and C are the substantive engineering; D is a refinement pass. None of this touches the already-verified launch-gate work.

---

## §11 — Research appendix (sources)

All research was gathered from primary policy pages where reachable, with secondary corroboration where the retailer blocked automated fetch (Amazon/Walmart). Key source URLs are inlined at each claim in §2. Coverage:
- **Indian marketplaces / quick-commerce:** Amazon India, Flipkart/Supermart, BigBasket, Blinkit, Zepto, Swiggy Instamart.
- **Premium chocolate (Western):** Lindt, Godiva, Hotel Chocolat, Läderach, Thorntons, Ferrero (no DTC).
- **Premium chocolate (India):** Paul And Mike, Royce' India, Smoor, Entisi, La Folie, Bogatchi.
- **Global grocery:** Amazon US (Fresh/Whole Foods), Walmart (Fresh Guarantee), Instacart.
- **Legal / safety / payments:** CP (E-Commerce) Rules 2020, FSSAI cold-chain + shelf-life, RBI refund-TAT & PA/PG escrow rules, Razorpay Refunds API + Payout Links, Shopify cancel-vs-return model.

**"Not published" flags (be aware when drafting legal copy):** Amazon/Walmart exact on-page sentences (bot-blocked; corroborated via help snippets + secondary sources); Smoor & Thorntons heat policies (none published); Ferrero has no DTC returns policy at all; several Indian D2C report-window numbers come from FAQ pages that may change.
