# KAKOA Refund Strategy — Industry Research & Recommendation

> **Scope:** How leading e‑commerce and food businesses handle refunds — especially where
> **product returns are NOT accepted** (perishable food) — and a recommended, production‑ready
> **hybrid (automatic + manual)** refund architecture for KAKOA, a premium D2C chocolate brand in India.
> **No code is implemented here** — this is research + recommendation + a phased plan.

> ### ⚠️ Sourcing & confidence note (read first)
> An automated deep‑research harness ran (105 agents, ~21 min) but **crashed on its final
> citation‑synthesis step**, so machine‑verified per‑claim citations were lost. This report is
> therefore synthesized from **well‑established, publicly documented industry practice** — these
> refund patterns are stable and widely reported, not speculative — **grounded in KAKOA's actual
> architecture** (built this session). Confidence is marked per claim:
> **[D]** = documented in the company's help center / API docs / regulator; **[P]** = a widely‑observed
> *pattern* across many players (individual brand specifics vary); **[I]** = *inferred* from typical
> behavior, verify before writing policy. **Before finalizing customer‑facing policy copy, re‑verify
> the specific brand rows against their live policy pages** — help‑center rules change.

---

## 0. Executive summary (TL;DR)

The industry has converged on a clear model, and it maps cleanly onto food:

1. **Refunds are increasingly AUTOMATIC for low‑value, low‑risk, provable cases** (cancel‑before‑ship,
   payment failures, "never delivered", small‑basket quality complaints) and **MANUAL (evidence‑reviewed)
   for higher‑value or unprovable claims** (melt/damage/quality on a premium hamper). This is a
   **hybrid / tiered** model — the global best practice. **[P]**
2. **Quick‑commerce (Blinkit/Zepto/Instamart/BigBasket) leads on speed**: in‑app "report issue" →
   **instant wallet/source refund**, mostly **rule‑based auto‑approval** for small amounts, with
   **fraud velocity checks** that flip repeat claimers to manual. **[P]**
3. **Perishable‑food sellers (FreshToHome, Licious, premium chocolate) don't take returns**; they
   resolve **without physical return** via **refund OR replacement**, usually **photo‑evidence gated**
   and **support‑reviewed** for anything but trivial value. **[P]**
4. **Melted chocolate is the signature edge case**: premium brands split between (a) **proactively
   refund/replace to protect brand** (Hotel Chocolat‑style service) and (b) **exclude heat‑melt from
   liability** (ship with ice packs in summer, disclaim). The premium‑brand norm is **(a) for
   "arrived damaged/melted with photo", with a summer thermal‑packaging disclaimer**. **[P/I]**

**KAKOA recommendation:** a **hybrid engine** — **auto‑refund** the mechanical/provable cases
(cancel‑pre‑ship, payment failure, RTO/lost‑in‑transit, delivery‑never‑arrived), **manual‑with‑photo**
for post‑delivery quality/melt/damage claims via the existing `return_requests` table, **auto‑reject**
changed‑mind‑after‑dispatch for perishables (offer goodwill store‑credit at discretion). Refund to
**source for prepaid** (Razorpay), **UPI/bank payout for COD**. **Restore coupon, refund GST
proportionally, refund shipping only when KAKOA/courier is at fault.** All of it maps onto the
statuses + `refunds` ledger + `return_requests` RMA you already have. Details in **§9–§10**.

---

## Deliverable 1 — Refund workflows across major e‑commerce platforms

| Platform | How customer requests | Auto vs manual | Evidence | Full/partial | Timeline (to source) | Notes |
|---|---|---|---|---|---|---|
| **Amazon (IN/US)** | App/site → "Return or replace items" / "Problem with order"; **A‑to‑z Guarantee** for 3P | **Mostly auto** for eligible returns/low value & trusted accounts; **manual** for A‑to‑z & high‑risk **[D/P]** | Photo optional; sometimes "keep the item" (returnless refund) for low value **[P]** | Both; can refund without return for low‑value/defective **[P]** | Instant→Amazon Pay balance; ~2–5 biz days to card/bank **[P]** | Pioneered **returnless refunds** + instant‑to‑wallet; ML risk‑scores accounts **[P/I]** |
| **Flipkart** | App → "Return"; QC at pickup/doorstep | **Manual/QC‑gated**: refund after return pickup passes quality check; wrong/damaged → **replacement first** **[P]** | Photo/IMEI/opened‑box video sometimes required **[P]** | Both | ~3–7 biz days; instant options exist **[P]** | Heavier QC than Amazon; wrong‑item ⇒ replacement bias **[P]** |
| **Myntra** | App → easy returns / try‑&‑buy | **Auto‑approved returns** (apparel), refund on pickup **[P]** | Rarely photo | Both | ~3–7 biz days | Apparel = returns allowed; **not a food model** — cited for contrast **[P]** |
| **Tata CLiQ** | App/site → return/replace | Manual‑leaning, QC on pickup **[P]** | Sometimes | Both | ~5–7 biz days | Standard marketplace flow **[I]** |
| **Walmart (US)** | App/site → start return; **"keep it" returnless** for many low‑value items **[P]** | **Auto** for eligible; manual for exceptions | Photo optional | Both | ~ up to card cycle | Aggressive returnless refunds to cut reverse‑logistics cost **[P]** |
| **Shopify stores (Loop / AfterShip / Returnly‑pattern)** | Branded returns portal / "Contact us" | **Rules engine**: auto‑approve within policy window & rules; else route to a **manual queue**; **store‑credit incentivized** over cash **[D/P]** | Configurable photo upload on damage reasons **[D]** | Both; **bonus credit** to steer to store credit **[P]** | Refund via Shopify Payments/gateway; instant options **[P]** | This is the **closest template for KAKOA** — a rules engine + a manual queue + store‑credit nudge **[P]** |

**Common pattern:** big players **automate the cheap/provable cases** and **route the rest to a
review queue**; **returnless / no‑return refunds** are now mainstream for low value and perishables;
**store credit** is the preferred settlement to retain revenue. **[P]**

---

## Deliverable 2 — Food industry refund practices (quick‑commerce + premium chocolate)

### Quick‑commerce & grocery (India) — speed‑first, auto‑heavy
| Player | Request | Auto vs manual | Evidence | Settlement | Notes |
|---|---|---|---|---|---|
| **Blinkit / Zepto / Swiggy Instamart** | In‑app "Report an issue" on the order/item (missing, damaged, wrong, quality) | **Mostly instant AUTO‑approve** for small baskets; **velocity/fraud checks** flip repeat users to manual/deny **[P]** | Photo sometimes prompted for damage/quality **[P/I]** | **Instant refund to wallet or source**; partial (per‑item) common **[P]** | No physical return of perishables; goodwill‑first for retention **[P]** |
| **BigBasket** | App → "Return/Refund" per item | **Semi‑auto**; larger/repeat claims reviewed **[P]** | Photo for damage **[P]** | Wallet credit or source; partial per line **[P]** | Slotted delivery; QC at doorstep option **[I]** |
| **FreshToHome / Licious** (perishable meat/seafood) | App/support → quality complaint | **Manual‑reviewed**, but liberal; **refund or replacement**, no return **[P]** | **Photo usually required** for quality/damage **[P]** | Wallet credit or source; often **replacement** **[P]** | Perishable ⇒ **no return, evidence‑gated, generous** to protect trust **[P]** |
| **Country Delight** (subscription dairy) | App → "Report issue" on a delivery | **Auto wallet‑credit** for small amounts; larger → review **[P/I]** | Rarely photo for small credits **[I]** | **Wallet credit** (subscription model) **[P]** | Micro‑refunds automated; wallet keeps money in‑ecosystem **[P]** |

### Premium chocolate / gourmet DTC — brand‑protective, photo‑gated
| Brand | Typical stance (verify live) | Melt handling | Settlement |
|---|---|---|---|
| **Lindt, Godiva, Ferrero DTC** | Food = **generally non‑returnable**; damaged/incorrect → contact support with photos → refund/replace **[P/I]** | Often **disclaim heat‑melt**, ship with ice packs / hold shipping in heat waves; case‑by‑case goodwill **[I]** | Refund to source or replacement **[I]** |
| **Hotel Chocolat** | Known for **strong service**: damaged/faulty → replace or refund on contact **[P]** | Replaces melt‑damaged; summer thermal packaging **[I]** | Refund/replace **[P]** |
| **Läderach, Royce', Smoor (India)** | Premium, perishable → **no returns**; quality/damage handled by support, evidence‑led **[I]** | Cold‑chain / ice‑pack shipping; melt disclaimers in summer **[I]** | Refund or replacement **[I]** |

**Food pattern that KAKOA should adopt:** **no physical returns**; resolve via **refund OR replacement**;
**photo evidence required** for post‑delivery quality/damage/melt; **small‑value auto goodwill**, **higher‑value
manual review**; **summer thermal‑packaging + a clear heat‑melt disclaimer** to bound liability without
alienating customers. **[P]**

---

## Deliverable 3 — Manual vs Automatic refunds (analysis + threshold model)

**Always AUTOMATIC (no human):** payment failed/double‑charged; customer **cancels before dispatch**;
order **confirmed but out‑of‑stock** (seller‑initiated); **RTO / lost‑in‑transit / undelivered** (courier
signal is the proof); refund of a **failed COD** attempt. These are **mechanically provable from system
state** — no judgment needed. **[P]**

**Usually AUTOMATIC below a value threshold (rule‑based goodwill):** small "missing item", minor damage,
quality complaint on a **low‑value** basket from a **low‑risk** account — quick‑commerce approves these
instantly to protect retention; cheaper to refund than to investigate. **[P]**

**Always MANUAL (evidence review):** post‑delivery **melt/damage/quality/spoilage** above the threshold;
**"never received" on a delivered‑scanned order** (fraud‑sensitive); **wrong high‑value item**; anything
from a **flagged/high‑velocity account**; **partial refunds requiring negotiation**. **[P]**

| Approach | Pros | Cons |
|---|---|---|
| **Automatic (rules engine)** | Instant CX, low ops cost, scales, consistent | Fraud exposure if thresholds too loose; can't judge nuance |
| **Manual (human review)** | Fraud control, nuance, evidence weighing | Slow, costly, inconsistent between agents, doesn't scale |
| **Hybrid (recommended)** | Fast where safe, careful where risky; tunable | Needs a rules engine + a queue + good thresholds |

**Decision‑threshold model (recommended defaults for KAKOA — tune with data):**
- **Auto‑approve** if: reason ∈ {system‑provable set} **OR** (refund ≤ **₹500** **AND** account_age > 30d
  **AND** prior_refunds_90d < 2 **AND** photo attached for damage reasons).
- **Manual review** if: refund > ₹500 **OR** account flagged/high‑velocity **OR** "not received" on a
  delivered order **OR** reason ∈ {melt, spoilage, quality} above threshold.
- **Auto‑reject (offer goodwill instead)**: changed‑mind **after dispatch** for perishables.
- Everything **configurable** via settings (thresholds live in `store_settings`, per §9).

---

## Deliverable 4 — Refund decision matrix by order status

Mapped to KAKOA's **actual** statuses. "Auto" = system issues refund without human; "Manual" = admin
approves; "Evidence" = photo/proof gate.

| Order status | Customer can request? | Admin approval? | Auto? | Replacement offered? | Evidence? | What happens next |
|---|---|---|---|---|---|---|
| **pending_payment** | N/A (no money captured) | — | — | — | — | Auto‑expire; no refund needed |
| **payment_failed** | N/A | — | **Auto** (any partial capture reversed) | — | — | Gateway auto‑reverses; nothing owed |
| **cod_pending_confirmation** | Cancel freely | No | **Auto** (nothing captured) | — | — | Cancel → close; no money moved |
| **confirmed** (paid, not packed) | **Yes — cancel** | No | **Auto full refund** (incl. shipping) | — | No | Cancel → full refund to source |
| **packed** (paid, not shipped) | **Yes — cancel** | No (auto) / optional | **Auto full refund** | — | No | Cancel → restock → full refund |
| **shipped** | Cancel = **hard** (in courier) | **Yes** | No | Sometimes | No | Attempt courier recall → if RTO, refund on return‑to‑origin; else wait for delivery |
| **out_for_delivery** | Limited | **Yes** | No | — | No | Usually must wait; refuse‑delivery → RTO path |
| **delivered** | **Yes — damage/quality/missing/wrong** (within window, e.g. 48h for melt/damage, up to 7d per your RMA) | **Manual** (auto only under threshold) | Threshold‑based | **Yes** (often preferred) | **Yes — photo** | `return_requests` claim → review → refund or replacement |
| **cancelled** | Already resolved | — | **Auto** if paid | — | — | Refund already issued on cancel |
| **rto_initiated** | — | No | Pending | — | — | Await return‑to‑origin |
| **rto_delivered** (back at origin) | — | No (auto) | **Auto refund** (minus non‑refundable fees per policy) | — | — | Goods back → auto‑refund |
| **Failed delivery** (NDR exhausted → RTO) | — | No | **Auto on RTO** | Re‑attempt/replace at discretion | — | Multiple NDR → RTO → auto‑refund |
| **Lost in transit** (courier declares) | **Yes** | Light/manual | **Auto/near‑auto** (courier proof) | **Replacement** common | Courier proof | File courier claim in parallel; refund/replace customer |

---

## Deliverable 5 — Customer journey (transparent, food‑appropriate)

**States the customer sees** (drives your comms + the storefront tracking page):
`Requested → Under review (if manual) → Approved → Refund initiated → Refund processed (₹X to <method>) → Completed`
(or `Rejected — reason` / `Replacement scheduled`).

**Communication cadence (email + SMS + in‑app), per best practice [P]:**
1. **On request:** "We've received your request for order #… — here's what happens next + expected time."
2. **On decision:** approved / need‑more‑info / rejected (with a clear, kind reason).
3. **On refund initiated:** "₹X refunded to your <UPI/card/bank> — expect it in **<method‑specific TAT>**."
4. **On processed/settled:** confirmation + a reference id.
- **Set expectations by method** up front: UPI ~instant–24h, cards/net‑banking ~5–7 business days,
  COD bank/UPI payout ~2–5 business days. **[P]** (RBI/rail‑dependent; state ranges, not promises.)
- **Self‑serve tracking**: a refund status timeline on `/account` + the order page (reuse your existing
  tracking timeline pattern). **Escalation**: a "Contact support" path if stuck > SLA.

**Why this matters:** the #1 driver of refund‑related CX complaints is **opacity** ("where's my money?").
Leaders win by **over‑communicating status + realistic ETAs**. **[P]**

---

## Deliverable 6 — Admin workflow

**Refund/claim queue → evidence → decide → refund → audit** (maps to an admin "Returns/Refunds" module):
1. **Queue** — all `return_requests` with `status='requested'` (+ RTO/lost auto‑cases surfaced), sorted by
   age/value; filters by reason, value, risk flag.
2. **Evidence review** — order + payment history, the customer's **photos**, prior‑refund count, account
   age/velocity risk score, delivery scan (was it actually delivered?).
3. **Decide** — **Approve (full/partial)**, **Replace**, or **Reject (reason)**; **internal note** (private)
   + **customer message** (sent). Partial refund = choose amount ≤ remaining refundable.
4. **Execute refund** — reuse the existing money‑path (provider refund for prepaid; a COD payout record);
   idempotent; writes the `refunds` ledger row + updates `return_requests`.
5. **Audit** — every decision + money move in `admin_audit_log` (who/when/before/after) — non‑repudiation.
6. **History** — per‑customer and per‑order refund history visible to agents (spot serial claimers).

**Admin sees:** value at risk, refundable remaining, risk signals, evidence, one‑click approve/partial/reject,
and a full audit trail. (This is the **Returns/Refunds admin module** — a natural next build.)

---

## Deliverable 7 — Fraud prevention

**Patterns to defend against [P]:**
- **INR abuse** ("item not received" on a delivered‑scanned order) — the most common e‑com refund fraud.
- **Serial refunders** — accounts that claim on a high fraction of orders.
- **Empty‑box / partial‑missing** claims that can't be disproven.
- **COD‑specific (India):** **RTO abuse** (refuse delivery repeatedly), address/phone churn, first‑party fraud.

**Controls (layered):**
1. **Delivery proof gate** — for "not received" on a `delivered` order (courier scan/OTP‑POD), default to
   **manual** + require the courier to confirm; don't auto‑refund. **[P]**
2. **Photo/evidence gating** — melt/damage/quality claims require a photo (you already support `photo_urls`).
3. **Velocity & value thresholds** — auto‑approve only small value + low prior‑refund count; everything else manual.
4. **Account risk score** — age, order count, refund ratio, chargeback history → a simple score that gates auto‑approval.
5. **One open RMA per order** (you already enforce this via a unique index) — blocks duplicate claims.
6. **Refund‑window enforcement** — melt/damage must be reported fast (e.g. 24–48h), before a customer could
   have consumed/spoiled it themselves. **[P]**
7. **COD:** prefer **prepaid** (you launched prepaid‑only — good); for COD, **verify the phone (OTP)** before
   dispatch and track RTO rate per customer; refund COD only to a **verified UPI/bank** the customer provides.
8. **Blocklist** — repeat abusers → `customers.is_blocked` (you already have this flag) → block new orders / force manual.

**Guardrail:** fraud controls must **fail toward fairness for genuine, low‑value cases** (auto‑approve small
goodwill) and **toward caution for high‑value/unprovable cases** (manual + evidence). Over‑policing small
claims destroys CX; under‑policing large ones bleeds money. **[P]**

---

## Deliverable 8 — Best practices for FOOD businesses with no returns

1. **No physical return of perishables** — resolve via **refund or replacement** only. **[P]**
2. **Replacement‑first for genuine quality failures** (retains revenue, satisfies the customer) — offer it
   before cash where sensible. **[P]**
3. **Photo evidence is the backbone** — it's the only substitute for inspecting a returned item.
4. **Tight reporting window** for perishables (24–48h for melt/damage) — bounds fraud + matches food reality.
5. **Own the cold chain / heat risk** — ship with **ice packs/insulation in summer**, optionally **hold
   dispatch during heat waves**, and publish a **clear heat‑melt disclaimer**; then **be generous on genuine
   melt claims** anyway, because brand trust > the cost of one bar. This is the premium‑brand consensus. **[P/I]**
6. **Generous, fast, transparent on small claims; careful on large** — the hybrid threshold model.
7. **Food‑safety framing in copy** — "for hygiene and food safety, we can't accept returns, but we'll make
   it right with a refund or replacement" reads as caring, not restrictive.
8. **Compliance:** align with **India's Consumer Protection (E‑Commerce) Rules, 2020** (clear refund policy,
   timelines, grievance officer) and **FSSAI** expectations for food. **[D — regulation exists; confirm specifics with counsel.]**

---

## Deliverable 9 — Recommended refund ARCHITECTURE for KAKOA (hybrid)

A **rules‑engine + manual‑queue** hybrid, mapped onto what you already built.

### 9.1 The auto/manual boundary (exact)
**AUTO‑REFUND (no human), reuse the existing money‑path immediately:**
- `payment_failed` / double‑charge → gateway reversal.
- Cancel while `confirmed` or `packed` (pre‑dispatch) → **full refund incl. shipping**.
- `rto_delivered` (goods back at origin) / **lost‑in‑transit** (courier‑declared) / **NDR‑exhausted RTO** →
  **auto‑refund** (per fee policy) or auto‑offer replacement.
- **Small‑value goodwill** (≤ threshold, low‑risk account, photo attached for damage) → auto‑approve the
  `return_request`.

**MANUAL (admin queue, evidence‑reviewed) via `return_requests`:**
- Post‑`delivered` **melt / damage / spoilage / quality / wrong‑item / missing** above the value threshold.
- **"Not received" on a `delivered` order** (fraud‑sensitive) — always manual + delivery proof.
- Any claim from a **flagged/high‑velocity** account.

**AUTO‑REJECT (offer optional goodwill store‑credit):**
- **Changed‑mind after dispatch** for perishables (with a kind explanation + food‑safety framing).

### 9.2 Financial handling (India specifics)
- **Prepaid (Razorpay):** refund to **source** via the provider refund API (full or **partial**); support
  **instant** where available, else standard TAT. You already write a `refunds` ledger row + bump
  `payments.amount_refunded_paise` — keep that path; **never exceed remaining refundable**. **[D — Razorpay refunds API]**
- **COD:** no source to refund → **UPI/bank payout** to a customer‑provided, **verified** destination (your
  `refunds` table already models `destination ∈ {original_method, bank_transfer, upi}` + an operator
  `reference`). Manual payout + reference capture. **[P]**
- **Partial refunds:** per‑line (refund the melted bar, not the whole hamper) — sum of partials ≤ order total;
  status → `partially_refunded` then `refunded` at full.
- **Shipping fee:** refund it **only when KAKOA/courier is at fault** (damage, wrong item, never delivered,
  cancel‑before‑ship). **Not** refunded for changed‑mind/goodwill. Make this a **configurable rule**. **[P]**
- **GST:** refund **proportionally** — since prices are GST‑inclusive, refunding ₹X returns the embedded
  CGST/SGST/IGST within it (issue a **credit note**; your `splitGst` already computes the split). **[D — GST credit‑note requirement]**
- **Coupon handling:** on a **full** refund, **release the coupon redemption** (decrement
  `coupons.redemption_count`, delete/void the `coupon_redemptions` row) so the customer can reuse it;
  on a **partial** refund, **keep** the coupon consumed but refund the net paid. Decide + document. **[P]**
- **Gift cards:** deferred (none yet) — when added, refund to gift‑card balance where the order used one.

### 9.3 Maps onto your existing system (no re‑architecture)
- **Statuses** — already have `cancelled`, `rto_initiated`, `rto_delivered`; the auto cases key off these.
- **`return_requests`** (RMA) — already has reasons (`damaged_or_melted`, `wrong_item`, `quality_issue`,
  `changed_mind`, `other`), resolutions (`refund | replacement`), `photo_urls`, `decided_by/decided_at/
  decision_note`, and a **one‑open‑RMA‑per‑order** unique index. This **is** your manual‑claim spine.
- **`refunds` ledger + money‑path** — already idempotent, provider‑backed, audited. Auto and manual both
  call it.
- **`customers.is_blocked`** — the fraud blocklist.
- **`store_settings`** — hosts the tunable thresholds (auto‑approve ₹ cap, reporting window, shipping‑refund rule).
- **Notifications** — the refund‑status comms ride the Notifications module (Resend email now; SMS via
  Fake/MSG91 per the provider plan).

**Net:** KAKOA needs a **rules engine + an admin refund/claim queue + evidence upload + status
notifications** on top of infrastructure that **already exists**. It's an assembly job, not a rebuild.

---

## Deliverable 10 — Step‑by‑step implementation plan (phased)

**Phase A — Foundations & policy (no new money code)**
1. Write the **refund policy** (windows, what's covered, food‑safety framing, method TATs) + the
   **decision matrix** (§4) as the source of truth. Align to Consumer Protection (E‑Commerce) Rules 2020 + FSSAI.
2. Add tunable settings to `store_settings`: `refund_auto_approve_cap_paise`, `melt_damage_report_window_hours`,
   `shipping_refundable_on_fault` (bool), `refund_window_days`.

**Phase B — Evidence + customer request UX**
3. **Evidence upload** — wire `return_requests.photo_urls` to a real image upload (needs the **Media/storage**
   integration — the one deferred module). Storefront "Report a problem" flow on a delivered order → creates a
   `return_request` with reason + photos.

**Phase C — Auto‑refund rules engine**
4. A pure `refund-rules.ts` (unit‑tested): input = {order status, reason, value, account risk, photo present,
   settings} → output = `auto_approve | manual | auto_reject`. This is the §3 threshold model, configurable.
5. Wire the **system‑provable auto cases** (cancel‑pre‑ship, payment fail, RTO/lost/NDR) to call the existing
   money‑path automatically — most already exist via `executeCancelRefund`; extend to RTO/lost/NDR triggers.

**Phase D — Admin Refund/Claim queue module** (`/admin/returns` or fold into Orders)
6. Data layer + routes + UI: the queue → evidence viewer → approve(full/partial)/replace/reject with internal
   note + customer message → executes via the money‑path → audits. (Follows the exact admin‑module conventions
   used by every other module; permission e.g. `orders:refund`.)
7. **Partial refund** UI (per‑line), **COD payout** capture (destination + reference), **coupon release** on full refund.

**Phase E — Notifications + tracking**
8. Refund‑status templates (requested/approved/rejected/initiated/processed) via the Notifications module;
   email now (Resend), SMS when DLT is done. Method‑specific ETA copy.
9. **Customer refund‑status timeline** on `/account` + order page (reuse the tracking‑timeline pattern).

**Phase F — Fraud & tuning**
10. Add the **account risk score** (age, order count, refund ratio) + velocity limits; gate auto‑approval on it;
    surface risk in the admin queue; wire `is_blocked`. Then **tune thresholds with real data** (start
    conservative, loosen as fraud data allows).

**Suggested order:** A → C(system‑provable auto) → D(admin queue) → E(comms) → B(evidence upload, once Media
lands) → F(fraud scoring). This ships value fast (auto‑refunds + an admin queue) before the storage‑dependent
evidence UX.

---

### Appendix — source types & caveats
- **[D] Documented:** Razorpay Refunds API (full/partial, instant vs normal, source‑only for online),
  GST credit‑note rules for refunds, RBI transaction‑TAT norms, Consumer Protection (E‑Commerce) Rules 2020,
  Amazon A‑to‑z / returnless‑refund program, Shopify returns‑app rules engines.
- **[P] Widely‑observed patterns:** quick‑commerce instant wallet refunds + auto‑approval + fraud velocity
  checks; perishable "no return, photo‑gated refund/replace"; premium‑chocolate damage/melt handling;
  store‑credit‑over‑cash nudging; returnless refunds for low value.
- **[I] Inferred — verify:** specific premium‑brand internal thresholds and exact melt/heat liability wording;
  exact per‑platform refund TATs (change often).
- **Re‑verify before customer‑facing policy copy:** brand help‑center specifics and TATs; India regulatory
  specifics with counsel. This report is decision‑grade for **architecture**, and directional for **exact
  brand policy numbers**.
