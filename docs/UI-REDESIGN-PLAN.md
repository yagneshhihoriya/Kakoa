# KAKOA Storefront UI/UX Redesign — Plan & Design System

**Brief:** Elevate the storefront to a premium, immersive, conversion-focused D2C experience
on par with leading luxury food brands (reference: [mokkafarms.com](https://www.mokkafarms.com/)),
adapted to chocolate with a distinct identity. **Presentation layer only** — no changes to
business logic, APIs, backend, auth, checkout, payments, DB, or admin.

**Direction locked with the user (2026-07-13):**
- **Imagery:** real product photography (user-provided). Every image slot is photo-ready today.
- **Identity:** *elevate* the existing cocoa / cream / gold + DM Serif Display + Hanken Grotesque
  identity — preserve brand equity, dramatically upgrade composition, scale, motion, and craft.
- **Rollout:** design-system foundation + Home first (this slice), then roll out the rest on approval.

---

## 1. What this reference taught us (Mokka Farms, observed)

| Mokka signal | KAKOA adaptation (chocolate) |
|---|---|
| Warm coffee-brown/maroon + cream/tan accents | Keep cocoa / cream / gold — already aligned |
| Editorial **serif** typography, big scale contrast | DM Serif Display at a new fluid `text-hero` scale |
| Full-bleed **provenance** hero (farm → roast → cup) | **Bean → bar** provenance hero + process strip |
| Category-grouped **product rails** with rich cards | Collection cards + best-seller rails, upgraded card |
| Story / video **storytelling bands** | Story band + "Four movements" craft strip |
| Rotating trust **ribbon / marquee** | Refined announcement + editorial craft marquee |
| Generous white space, confident composition | Larger section rhythm, fluid type, warm elevation |

We did **not** copy Mokka — we captured the craft level and expressed it in KAKOA's own cocoa identity.

---

## 2. Design system (implemented — `packages/ui/src/tokens.css`, additive)

The token architecture (single source of truth, semantic aliases, mobile-first) was already
excellent. The redesign **extended** it; every prior token is unchanged.

### 2.1 Color — unchanged core, new semantic neutrals
Brand palette kept verbatim: `ink #2a1d12`, `cocoa #4a2e1c`, `espresso #8a5a34`, `cream #fbf6ef`,
`card #f3e7d5`, `line #eadbc6`, `gold #c69a4c`, plus caramel / raspberry / pistachio / plum.
**New** (promoting ~40 off-token browns that leaked across pages):
`--color-ink-soft #5c4b3a`, `--color-ink-muted #8a7a68`, `--color-ink-hover #3f2c1b`,
`--color-cocoa-deep #2c150a`, `--color-surface #fff`, `--color-cream-2 #f6eee1`,
`--color-line-soft #eee1ce`, `--color-gold-soft #e8c9a0`.

### 2.2 Type — new fluid display scale (`clamp`, 360 → 1280px)
`text-eyebrow` (mono, 0.22em) · `text-lead` · `text-h3` · `text-h2` · `text-h1` ·
`text-hero` (clamp 2.9→5.75rem, ~46→92px). Body keeps Tailwind defaults. Fonts unchanged:
DM Serif Display (display), Hanken Grotesque (body), DM Mono (eyebrow labels).

### 2.3 Elevation — warm cocoa-tinted shadows
`shadow-soft` · `shadow-card` · `shadow-lift` · `shadow-float` — all share the ink hue so cards
feel like they sit on warm paper, never a cold grey UI.

### 2.4 Motion
`ease-brand` (house curve) · `ease-entrance` (soft decelerate) · `--duration-fast|base|slow`.
New keyframes: `kk-kenburns` (hero zoom), `kk-shimmer` (skeletons), `kk-marquee` (ticker),
`kk-rise`. Utility `.kk-grain` (pure-CSS paper grain on dark bands) and `.kk-marquee`.
All honor `prefers-reduced-motion`.

### 2.5 Spacing / radius / breakpoints
Unchanged (4px base; pill radius for buttons & chips; mobile-first 640/1024/1280).

---

## 3. Interaction & motion guidelines

- **Reveal:** every `main > section` fades up on scroll (existing `SectionReveal`, IO-based,
  reduced-motion + 1.7s never-hide failsafe). Preserved.
- **Hover:** cards lift (`-translate-y-1`) + deepen shadow (`shadow-card → shadow-lift`); imagery
  slow-zooms inside an `overflow-hidden` frame (compositor-only transform).
- **Micro-interactions:** wishlist heart scales on hover; collection cards reveal a `→` affordance;
  cart count keeps its `kk-pop`.
- **Never animate** layout properties; only `transform` / `opacity`. Everything degrades under
  reduced-motion.
- **Perf note / follow-up:** the hero float/drift and the marquee are currently `infinite`. They're
  cheap (transform), but should be scoped to run only while in the viewport (IO play/pause) in the
  rollout — this also keeps automated browser tooling responsive.

---

## 4. Presentation ↔ logic seam (the guarantee)

Sourced from the frontend readiness map. **Restyle freely:** className/JSX/markup, class-map
constants, CSS values, art-direction components. **Never touch:** data fetching, server actions,
state machines, money math, a11y wiring, SEO/JSON-LD, network contracts.

| Area | Preserved logic (untouched this slice) |
|---|---|
| Home | `getCategories`/`getProducts`, per-category count loop, ruby-first `heroProduct`, `revalidate=300`, `main>section` reveal selector, aria ids |
| ProductCard | `imageUrl`-first render, badge/sold-out, `WishlistHeartButton`, `AddToBagButton`, `defaultVariantId` link fallback, stretched link |
| Header | cart-count hydration gate (`mounted`), `kk-pop`, `AccountControl` branching, `SearchOverlay`, mobile-menu state, `openCart` drawer-vs-`/cart` |
| Footer | `getFssaiLicense()` (India compliance), `getFullYear()`, async RSC, all routes |
| Announcement | price-free copy (threshold stays data-driven in cart) |

---

## 5. Page-by-page redesign approach

| Page | Status | Approach |
|---|---|---|
| **Design system** | ✅ Done | Extended tokens + globals (§2, §3) |
| **Home** | ✅ Done | Full-bleed provenance hero · editorial marquee · collection cards · best-seller rail · value band · story band · "Four movements" craft strip · club CTA |
| **Chrome** (header/footer/ribbon) | ✅ Done | Richer glass header; grain-textured editorial footer with serif brand statement; refined mono announcement |
| **Shop / Collection** | ⏳ Planned | Editorial header, refined filter chips + sort, upgraded card grid, mobile scroll-snap, richer empty state |
| **PDP** | ⏳ Planned | Sticky buy-box, gallery with photo-ready slots, tasting-notes/ingredients as elegant accordion, related/FBT rails |
| **Cart** | ⏳ Planned | Restyle only — line rows, free-ship progress, sticky summary (mutation logic preserved) |
| **Checkout** | ⏳ Planned | **Highest-risk** — restyle the step shell/summary; Razorpay/COD/quote/placement logic strictly untouched |
| **Account / Track / Orders / Invoice** | ⏳ Planned | Dashboard cards, refined order timeline, tracking states |
| **Legal / Support / Locator / Journal / About** | ⏳ Planned | Editorial long-form templates |

---

## 6. Component library plan (`@kakoa/ui` + storefront-shared)

- **This slice:** `ProductCard`, `ChocoPlaceholder`, `HeroShowcase` (art), header/footer chrome.
- **Rollout:** restyle `Button` (careful — shared with admin), `Badge`, `Chip`, `Price`,
  `StarRating`, `Field`/`Input`/`Select`, `QtyStepper`, `EmptyState`, `Skeleton` (wire `kk-shimmer`),
  `Drawer`/`Toast`. Consolidate the 3 duplicate reveal implementations into one primitive;
  centralize the copy-pasted focus ring into one exported constant + a global `:focus-visible` base.

---

## 7. Imagery pipeline (photo-ready today)

- **Product images** already render `product.imageUrl` via `next/image` (fill, `object-cover`,
  responsive `sizes`); the tone-gradient art is only the fallback. Populate images via the admin
  **Products** module → cards & PDP show real photos with **zero markup change**.
- **Hero / story / lifestyle imagery:** drop files in `apps/web/public/images/…` and pass the path;
  the hero/story components will accept an optional `imageSrc` and swap `<Image>` in for the CSS art.
- **To wire your real photos:** put them under `apps/web/public/` (or point me at them) and I'll
  connect the hero, story band, and category cards.

---

## 8. Accessibility & performance

- WCAG: skip-to-content link, visible gold focus rings, `aria-label`/`aria-labelledby` on sections,
  reduced-motion coverage, `alt` on all real images.
- CLS: every image slot is dimension-locked (`aspect-ratio` / `fill`).
- Fonts via `next/font` (no layout shift). Motion is transform/opacity only.
- Follow-up: scope infinite animations to in-view; add dark-mode via `[data-theme=dark]` overrides
  of the semantic aliases (tokens are ready for it).

---

## 9. Verification (this slice)

- `pnpm --filter web typecheck` — ✅ clean
- `pnpm --filter web build` — ✅ all pages compile; new `shadow-*`/`text-*`/`ease-*` utilities resolve
- Live (dev server): Home renders 8 sections, hero at 92px DM Serif Display, marquee + grain active,
  collection & product cards laid out with warm elevation; desktop + mobile hero verified by
  screenshot; lower sections verified by DOM assertion (preview pane won't repaint scrolled frames
  on this animation-heavy page — a tooling limitation, not a page defect).

---

## 10. Rollout order (safe sequence, on approval)

1. **Wire real photography** (hero/story/category + product images) — biggest single quality lift.
2. **Shop** → **PDP** (highest storefront traffic).
3. **Cart** → **Checkout** (restyle-only, extreme care on the money path).
4. **Account** cluster.
5. **Secondary** pages (legal/support/locator/journal/about).
6. **Component sweep** + token cleanup (sweep the ~40 off-token hexes to the new semantic tokens),
   dark mode, scope infinite animations.

Each page ships restyle-only, verified typecheck + build + live, and never alters logic.
