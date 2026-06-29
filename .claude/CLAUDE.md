# BRIXIT — Project Rules

BRIXIT is a citizen science platform for collecting and visualizing BRIX (sugar content) data in agriculture and sustainability. Mobile-first, map-driven, community-oriented.

## Design System

- **All colors go through CSS custom properties** defined in `src/index.css`. Never hard-code Tailwind color utilities like `bg-green-600` or `text-blue-500` — always use the semantic tokens (`bg-primary`, `text-muted-foreground`, etc.) mapped through `tailwind.config.ts`.
- If a new color role is needed, add a CSS custom property to `src/index.css` (both `:root` and `.dark`), wire it through `tailwind.config.ts`, then use the Tailwind class.

### Target Color Palette

Derived from UX handoff research. Nature/agriculture green palette with gold accent — replaces the generic shadcn gray HSL defaults during uplift. Implement as CSS custom properties in `src/index.css`.

> **Note:** these are the original handoff *targets*; several hexes were tuned during the uplift. The live values in `src/index.css` (and `.dark`) are authoritative. For scoring specifically, use the dedicated `--score-*` tokens (see [Score Visualization](#score-visualization)), not the green/gold tokens below.

| Token | Hex | Role |
|-------|-----|------|
| `--green-deep` | `#1a3a2a` | Dark backgrounds (hero, mission, footer), headings |
| `--green-mid` | `#1f6b3f` | Hover states, deep-green accents (Excellent **score** uses `--score-excellent`) |
| `--green-fresh` | `#40916c` | Primary buttons, links, eyebrow text |
| `--green-light` | `#74c69d` | Accent on dark backgrounds |
| `--green-pale` | `#d8f3dc` | Badge backgrounds, benefit icon backgrounds |
| `--green-mist` | `#f0faf2` | Section backgrounds, subtle fills |
| `--cream` | `#faf8f3` | Page background |
| `--gold` | `#e1b12c` | Gold accent (Average **score** uses `--score-average`) |
| `--text-dark` | `#1a2e1f` | Primary body text |
| `--text-mid` | `#3d5a47` | Secondary body text |
| `--text-muted` | `#7a9b82` | Labels, placeholders |

## Typography

- **Recommended pairing: Lora (display/headings) + DM Sans (body/UI)**. Lora is a distinctive serif suited to agricultural/scientific context; DM Sans is a clean geometric sans. This pairing emerged from UX research and is open to team override during uplift.
- Google Fonts import: `https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap`
- Load in `index.html`. Map through CSS custom properties (`--font-display`, `--font-body`) in `src/index.css` and wire into `tailwind.config.ts`.
- Do not introduce other font families without team agreement.

## Copy & Tone

- **Emotion before technology** — lead with outcomes ("know if your food is nutritious"), not infrastructure.
- **No crypto/blockchain jargon in user-facing UI** — wallet = "a key only you hold", never "BSV wallet" or "Mycelia certificate" in any copy a user sees. Exception: the footer trust badge "Secured by BSV Blockchain" is acceptable as a subtle credibility signal.
- **Benefit-led CTAs** — "Start tracking my food" not "Login with Desktop Wallet". Use social proof in CTAs where possible (e.g. "Join 8,400 conscious shoppers").
- Technical terminology is fine in developer docs, admin UI, and internal tooling — just not in the public-facing experience.

## Score Visualization

Scores are **crop-relative**, not absolute. Each crop has its own poor/excellent thresholds stored in the DB. The raw BRIX value is normalized to a 0–100%+ scale via `computeNormalizedScore` in `src/lib/getBrixColor.ts`, then colored via `rankColorFromNormalized`. Never compare raw BRIX values across different crops.

Score colors are their own dedicated `--score-*` tokens (not `--green-mid`/`--green-fresh`/`--gold`). These are the single source of truth — `rankColorFromNormalized` maps to the `bg-score-*` classes, and the hex getters resolve the same vars for markers/charts. Hexes below are the light-theme values; `.dark` defines brighter variants.

| Rating | Normalized range | Display | Color token |
|--------|-----------------|---------|-------------|
| Excellent | ≥ 1.75 | 75%+ | `--score-excellent` (`#1f6b3f`) |
| Good | 1.50–1.74 | 50–74% | `--score-good` (`#6fae3f`) |
| Average | 1.25–1.49 | 25–49% | `--score-average` (`#e1b12c`) |
| Poor | < 1.25 | 0–24% | `--score-poor` (`#c0392b`) |

There are **two display paths**, by surface:

- **Individual submission** (data rows, mobile cards, detail modal, map markers, data-entry preview) → quality label + color from the crop's four thresholds via **`gradeBrix(brix, thresholds)`** (returns `{ quality, bgClass, hex }`, built on `getBrixColor`/`getBrixQuality`). **No percentage.** `gradeBrix` derives the label from the color bucket, so they can never disagree.
- **Aggregate of submissions** (leaderboard, map clusters, crop/brand rankings) → normalized average **percentage** via `computeNormalizedScore` / `scoreBrix`, colored by `rankColorFromNormalized(n)` and displayed with `toDisplayScore(n)`.

Do not mix the paths: never use the normalized % path for an individual badge, and never use `gradeBrix` for an aggregate. Both paths resolve the same `--score-*` tokens — never add a parallel quality→color map.

## Mobile-First Strategy

- **One job per screen** on mobile — no competing CTAs or dense information panels.
- Single breakpoint at **900px** for desktop layouts.
- Use **bottom sheets** for detail views on mobile; inline expansion on desktop.

## Accessibility

- Respect `prefers-reduced-motion` on all framer-motion animations.
- Score numbers get `aria-label` with meaning (e.g., `aria-label="Brix score 19.2, rated Excellent"`).
- Bottom sheets need `aria-modal="true"`, `role="dialog"`, and focus trap.

## Components

- Use existing **shadcn/ui** components from `src/components/ui/`. The project has 50+ components already installed.
- Do not create parallel component libraries or duplicate primitives that shadcn already provides.
- Compose larger patterns from shadcn primitives rather than building from scratch.

## Animation & Motion

- Use **framer-motion** (already installed) for page transitions, entrance animations, and micro-interactions.
- Prefer orchestrated, intentional animations (staggered reveals, scroll-triggered entrances) over scattered, gratuitous motion.
- Keep durations snappy for mobile: 150-300ms for micro-interactions, 300-500ms for page transitions.

## Established UI Patterns

Patterns landed during the landing page build. Use these as defaults for new sections/components.

### Cards
- **Feature/benefit cards**: White background, `border` with `border-color: var(--green-pale)`, `shadow-sm`, `hover:shadow-md transition-shadow`, `rounded-2xl`. Icon badges use dark green (`--green-deep`) `rounded-xl` squares with white icons.
- **Score cards on dark backgrounds**: Solid white (`background: white`), `shadow-lg`, `rounded-2xl`. Never use glass/translucent cards on dark backgrounds — readability is poor.
- **Community feed cards**: White with `green-pale` border, large score number + rating label at top, product name below, location · user at bottom.
- **Score guide card**: White `rounded-2xl` with `shadow-sm`. Rows with score number (Lora bold, tier-colored) on left, label + description on right, short colored underline below each row.

### Dark Sections (hero, mission)
- Body text: `rgba(255,255,255,0.75)` — not `green-light` with opacity, not raw white.
- Eyebrow text: `var(--green-fresh)` or `#7a9b82` depending on contrast needs.
- Emphasized words in headings: `var(--green-light)` with `<em>` italic.

### Section Backgrounds
- Alternate between `--cream` and `--green-mist` for light sections.
- Dark sections use `radial-gradient(ellipse at ..., #244536 0%, var(--green-deep) 70%)`.
- Footer uses flat `--green-deep`.

### Layout
- Content sections use `max-w-5xl` container.
- Two-column layouts (`desktop:grid-cols-2`) for text + visual pairs.
- Left-aligned text is default; centered text only for mission/CTA sections.
- Eyebrow text: uppercase, `tracking-[0.2em]`, `text-sm`, `font-medium`, `color: var(--green-fresh)`.

## Frontend Design Skill

Detailed design guidance lives in `.claude/skills/frontend-design/SKILL.md`. It activates automatically when doing frontend work and provides opinionated direction on typography, color, motion, and spatial composition. Follow its principles, but always defer to the project-specific rules above when they conflict.

## Reference Artifacts

UX handoff materials live in `.claude/references/`:
- **`brix-redesign-v2.html`** — visual prototype (open in browser to preview)
- **`BRIX-UX-Handoff.docx`** — full UX handoff spec with copy guidelines, component patterns, and page structure

These are design input, not implementation specs. Extract principles; don't copy pixel-for-pixel.

## Key Files Reference

| Area | Files |
|------|-------|
| Theme/colors | `src/index.css`, `tailwind.config.ts` |
| Font loading | `index.html` |
| Layout shell | `src/components/Layout/Header.tsx` |
| Auth flow | `src/pages/WalletLogin.tsx`, `src/pages/CreateAccount.tsx` |
| Core pages | `src/pages/Leaderboard.tsx`, `src/pages/MapView.tsx`, `src/pages/DataBrowser.tsx` |
| UI primitives | `src/components/ui/` (shadcn/ui) |
