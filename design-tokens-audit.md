# Design Tokens Audit

Read-only inventory of the design tokens as they exist in the codebase (branch `audit/design-tokens`, off `master` @ `dbbcfb2`). Reports current state only — no recommendations applied, nothing renamed or rounded.

---

## 1. Source map

| Path | Kind | Holds |
|------|------|-------|
| `src/index.css` | CSS custom properties (`@layer base`) | The whole palette + semantic tokens. `:root` = light, `.dark` = dark overrides. Also `@font-face` for Cooper BT. |
| `tailwind.config.ts` | Tailwind theme config | Maps Tailwind color/utility names → `var(--token)` (and a few raw `var()`); `fontFamily`; `screens` (`desktop: 900px`); `borderRadius` (derived from `--radius`); `container`; `darkMode: ["class"]`. |
| `src/lib/breakpoints.ts` | JS constant | `MOBILE_BREAKPOINT = 900` (JS-side breakpoint, "kept in sync with tailwind.config.ts"). |
| `src/lib/getBrixColor.ts` | JS object (`colorMap`) | A de-facto score-color source: a `bg` map (Tailwind class names) and a `hex` map (literal hex) for poor/average/good/excellent + fallback. Independent of the `--score-*` CSS tokens. |

No SCSS variables, no `design-tokens.json`, no CSS-in-JS theme object exist. Component-level inline `style={{ ... }}` and Tailwind classes consume the above.

---

## 2. Primitive tokens (raw palette & scales)

All defined in `src/index.css` unless noted.

### Colours — raw palette

| Token | Light value | Dark value | Where defined |
|-------|-------------|-----------|---------------|
| `--blue-deep` | `#2c4a5c` | `#152230` | index.css |
| `--blue-mid` | `#5787a1` | `#4a7a94` | index.css |
| `--blue-light` | `#8cb3c9` | `#6a9ab5` | index.css |
| `--blue-pale` | `#dde8f0` | `#1e3347` | index.css |
| `--blue-mist` | `#eef4f8` | `#132130` | index.css |
| `--green-fresh` | `#639647` | `#7ab35b` | index.css |
| `--green-mid` | `#1f6b3f` | `#2a9460` | index.css |
| `--orange` | `#eb6e24` | `#f07830` | index.css |
| `--gold` | `#e1b12c` | `#f0c040` | index.css |
| `--cream` | `#faf8f3` | `#0d1a24` | index.css |

### Typography

| Token | Value | Dark value | Where defined |
|-------|-------|-----------|---------------|
| `--font-display` | `'Lora', Georgia, serif` | — | index.css |
| `--font-landing` | `'Cooper BT', Georgia, serif` | — | index.css |
| `--font-body` | `'DM Sans', system-ui, sans-serif` | — | index.css |
| `fontFamily.display` | `['Lora','Georgia','serif']` | — | tailwind.config.ts |
| `fontFamily.landing` | `['Cooper BT','Georgia','serif']` | — | tailwind.config.ts |
| `fontFamily.body` | `['DM Sans','system-ui','sans-serif']` | — | tailwind.config.ts |

**Font sizes / font weights:** no custom tokens — Tailwind defaults are used throughout (e.g. `text-sm`, `font-bold`). One ad-hoc size scale lives in `src/components/common/ScoreBadge.tsx` (`sm: px-2.5 py-1 text-sm`, `md: ... text-base`, `lg: ... text-2xl`) but it is not a token.

### Radii

| Token | Value | Where defined |
|-------|-------|---------------|
| `--radius` | `0.5rem` | index.css |
| `borderRadius.lg` | `var(--radius)` | tailwind.config.ts |
| `borderRadius.md` | `calc(var(--radius) - 2px)` | tailwind.config.ts |
| `borderRadius.sm` | `calc(var(--radius) - 4px)` | tailwind.config.ts |

### Breakpoints / spacing

| Token | Value | Where defined |
|-------|-------|---------------|
| `screens.desktop` | `900px` | tailwind.config.ts |
| `container.screens.2xl` | `1400px` | tailwind.config.ts |
| `container.padding` | `2rem` | tailwind.config.ts |
| `MOBILE_BREAKPOINT` | `900` | src/lib/breakpoints.ts |

No custom spacing scale, shadow tokens, or z-index tokens are defined — Tailwind defaults (`p-*`, `gap-*`, `shadow-sm/md`, `z-*`) are used directly.

### Safe-area (env) — constant across themes

| Token | Value |
|-------|-------|
| `--safe-top` | `env(safe-area-inset-top, 0px)` |
| `--safe-bottom` | `env(safe-area-inset-bottom, 0px)` |
| `--safe-left` | `env(safe-area-inset-left, 0px)` |
| `--safe-right` | `env(safe-area-inset-right, 0px)` |

---

## 3. Semantic tokens (role-based)

Role-based tokens **do** exist (alongside the primitives above). All in `src/index.css`. The shadcn group stores **HSL component triplets** (consumed as `hsl(var(--x))` in `tailwind.config.ts`); the BRIXIT group stores literal hex/rgba.

### shadcn semantic group (HSL triplets)

| Token | Light value | Dark value |
|-------|-------------|-----------|
| `--background` | `201 30% 49%` | `210 40% 10%` |
| `--foreground` | `0 0% 98%` | `30 20% 90%` |
| `--card` | `0 0% 100%` | `210 38% 14%` |
| `--card-foreground` | `43 12% 29%` | `30 20% 90%` |
| `--popover` | `0 0% 100%` | `210 38% 14%` |
| `--popover-foreground` | `43 12% 29%` | `30 20% 90%` |
| `--primary` | `22 83% 53%` | `22 83% 57%` |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--secondary` | `0 0% 100%` | `210 30% 20%` |
| `--secondary-foreground` | `43 12% 29%` | `30 20% 90%` |
| `--muted` | `201 25% 40%` | `210 30% 18%` |
| `--muted-foreground` | `0 0% 75%` | `30 12% 62%` |
| `--accent` | `204 43% 95%` | `210 30% 18%` |
| `--accent-foreground` | `43 12% 29%` | `30 20% 90%` |
| `--destructive` | `26 70% 51%` | `26 65% 45%` |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--border` | `205 39% 90%` | `210 30% 22%` |
| `--input` | `205 39% 90%` | `210 30% 22%` |
| `--ring` | `22 83% 53%` | `22 83% 57%` |
| `--sidebar-background` | `201 30% 49%` | `210 40% 12%` |
| `--sidebar-foreground` | `0 0% 100%` | `30 20% 90%` |
| `--sidebar-primary` | `22 83% 53%` | `22 83% 57%` |
| `--sidebar-primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--sidebar-accent` | `201 25% 42%` | `210 30% 20%` |
| `--sidebar-accent-foreground` | `0 0% 100%` | `30 20% 90%` |
| `--sidebar-border` | `201 25% 42%` | `210 30% 22%` |
| `--sidebar-ring` | `22 83% 53%` | `22 83% 57%` |

### BRIXIT semantic group (hex / rgba)

| Token | Light value | Dark value |
|-------|-------------|-----------|
| `--text-dark` | `#524d40` | `#e8e0d8` |
| `--text-mid` | `#6b6057` | `#b0a898` |
| `--text-muted` | `#9e9289` | `#7e7368` |
| `--score-poor` | `#d9772c` | `#f08040` |
| `--score-average` | `#e1b12c` | `#f0c040` |
| `--score-good` | `#6fae3f` | `#7fc850` |
| `--score-excellent` | `#1f6b3f` | `#2a9460` |
| `--action-primary` | `#eb6e24` | `#f07830` |
| `--action-primary-hover` | `#c85a1a` | `#d46520` |
| `--action-danger` | `var(--score-poor)` | `var(--score-poor)` |
| `--surface-canvas` | `#eef3f6` | `#0d1a24` |
| `--on-bg-text` | `rgba(255,255,255,0.80)` | — (constant) |
| `--on-bg-body` | `rgba(255,255,255,0.75)` | — (constant) |
| `--on-bg-subtle` | `rgba(255,255,255,0.65)` | — (constant) |
| `--on-bg-muted` | `rgba(255,255,255,0.55)` | — (constant) |
| `--on-bg-faint` | `rgba(255,255,255,0.40)` | — (constant) |
| `--badge-gold-bg` | `#fef6e4` | `#2e2208` |
| `--badge-gold-text` | `#96720e` | `#f0c040` |
| `--badge-amber-bg` | `#fdf0d8` | `#2a1e06` |
| `--badge-amber-text` | `#a06a10` | `#d4a830` |
| `--badge-poor-bg` | `#fdeee3` | `#2e1a0a` |
| `--badge-neutral-bg` | `#f2f4f6` | `#1e2830` |
| `--badge-neutral-text` | `#7a7268` | `#9e9890` |
| `--table-header` | `#f2f6f9` | `#1a2a38` |
| `--table-stripe` | `#f8fafc` | `#121e28` |
| `--rank-1-bg` | `#fbbf24` | `#f0c040` |
| `--rank-1-fg` | `#78350f` | `#2e2208` |
| `--rank-2-bg` | `#94a3b8` | `#8aa0b4` |
| `--rank-2-fg` | `#0f172a` | `#0d1620` |
| `--rank-3-bg` | `#c2763a` | `#c2763a` |
| `--rank-3-fg` | `#ffffff` | `#ffffff` |
| `--menu-surface` | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.06)` |
| `--menu-surface-border` | `rgba(255,255,255,0.16)` | `rgba(255,255,255,0.12)` |
| `--menu-inset` | `rgba(0,0,0,0.18)` | `rgba(0,0,0,0.28)` |

---

## 4. Theming mechanism

- **Implementation:** class-based. `tailwind.config.ts` → `darkMode: ["class"]`; `src/index.css` defines overrides under `.dark { … }`. Provider: `next-themes` `<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>` (`src/App.tsx`). No `[data-theme]`, no `prefers-color-scheme`.
- **Toggle:** `src/components/Layout/Header.tsx` — a Sun/Moon ghost button calling `setTheme(theme === "dark" ? "light" : "dark")` (present in both the desktop bar and the mobile menu header).
- **Change vs. constant:**
  - **Change between themes:** all of `--blue-*`, `--green-*`, `--orange`, `--gold`, `--cream`, `--text-*`, `--score-*`, `--action-primary(-hover)`, `--surface-canvas`, `--badge-*`, `--table-*`, `--badge-neutral-*`, `--rank-1`/`--rank-2`, `--menu-*`, and the entire shadcn + sidebar HSL set.
  - **Constant (no `.dark` override):** `--safe-*`, `--font-*`, `--radius`, all `--on-bg-*` (white-at-opacity, intended to sit on the blue/dark page in both themes), `--rank-3-bg`/`--rank-3-fg` (`#c2763a`/`#ffffff` in both), and `--action-danger` (always `var(--score-poor)`, which itself flips).

---

## 5. Usage reality-check

The token(s) the code actually resolves for each role (winning value):

| Role | Class / source used | Resolves to (light → dark) |
|------|--------------------|-----------------------------|
| **App / page background** | `bg-background` (`PageBackground`, `body`) | `--background` = `#5787a1` → `hsl(210 40% 10%)` |
| **Card / panel background** | `bg-card` | `--card` = `#ffffff` → `hsl(210 38% 14%)` |
| **Card-list backdrop** (data/your-data) | `bg-surface-canvas` | `--surface-canvas` = `#eef3f6` → `#0d1a24` |
| **Selected / active — tabs** (Leaderboard, Your Data) | `bg-card text-card-foreground border border-blue-light shadow-sm` | white pill + `--blue-light` border |
| **Selected / active — Purchase-Type pill** (DataEntry) | inline `backgroundColor: var(--green-fresh); color:'#fff'` | `--green-fresh` `#639647` → `#7ab35b` |
| **Active step node** (DataEntry stepper) | `bg-green-fresh text-white` | `--green-fresh` |
| **"Verified"** | `text-green-mid` (MobileSubmissionCard) / `bg-green-pale text-green-mid` (SubmissionTableRow) | `--green-mid`; **`green-pale` is undefined** (see §7) |
| **"Anchored"** | `text-blue-mid` + Shield icon (No Anchor → `text-text-muted-brown`) | `--blue-mid` |
| **Score tiers** (badge) | `getBrixColor.colorMap.bg`: poor `bg-score-poor`, average `bg-gold`, good `bg-green-fresh`, excellent `bg-green-mid` | `--score-poor`, `--gold`, `--green-fresh`, `--green-mid` |
| **Score tiers** (non-class, e.g. map markers / inline `tierColor`) | `getBrixColor.colorMap.hex`: `#c0392b` / `#c9a84c` / `#40916c` / `#2d6a4f` | literal hex — **different palette** from `--score-*` |
| **Primary CTA / submit** | `<Button>` default → `bg-primary` | `--primary` = `#eb6e24` → `hsl(22 83% 57%)` |
| **BRIX slider track** | `bg-blue-pale` (`ui/slider.tsx` Track) | `--blue-pale` |
| **BRIX slider fill** | `bg-primary` (Range) | `--primary` (orange) |
| **BRIX slider thumb** | `border-2 border-primary bg-background` (Thumb) | `--primary` border on `--background` fill |
| **Hairline / divider** | `border-blue-pale` (explicit) + global `* { @apply border-border }` | `--blue-pale` / `--border` (`hsl(205 39% 90%)`) |
| **Primary text** | `text-text-dark` / `text-card-foreground` | `--text-dark` / `--card-foreground` |
| **Muted text** | `text-text-mid`, `text-text-muted-brown` (=`--text-muted`), `text-muted-foreground` | `--text-mid` / `--text-muted` / `--muted-foreground` |

---

## 6. Hardcoded-value hotspots

| File:line | Literal | Probable token |
|-----------|---------|----------------|
| `src/lib/getBrixColor.ts:15–18` | `#c0392b` `#c9a84c` `#40916c` `#2d6a4f` | `--score-poor` / `--score-average` / `--score-good` / `--score-excellent` (and these literals **differ** from the token values) |
| `src/lib/getBrixColor.ts:19, 104` | `#d1d5db` (fallback) | `--badge-neutral-bg` / a muted token |
| `src/components/Map/InteractiveMap.tsx:51–54` | `#2d6a4f` `#40916c` `#c9a84c` `#c0392b` | score-tier markers → `--score-*` |
| `src/components/Map/InteractiveMap.tsx:411,456` | `#ffffff`; lines 370–439 `rgba(255,255,255,…)` / `rgba(0,0,0,…)` | popup surfaces → `--card` / on-bg tokens |
| `src/components/landing/MapPreviewPanel.tsx:82` | `#2d6a4f` | `--score-excellent` |
| `src/components/landing/MapPreviewPanel.tsx:49,83,84,147,161` | `rgba(255,255,255,…)` / `rgba(0,0,0,…)` | `--menu-surface` / overlay tokens |
| `src/pages/DataEntry.tsx:577,595` | `color:'#fff'` (selected Purchase-Type pill text) | `--primary-foreground` / white token |
| `src/components/common/SubmissionDetails.tsx` (≈ lines 53–145) | `bg-gray-50`, `text-gray-900/600/500` (many) | `--card` / `--surface-canvas` / `--text-dark` / `--text-mid` |
| `src/components/ui/combo-box-addable.tsx:131–140` | `text-gray-600`, `bg-gray-100` | `--text-mid` / `--accent` |
| `src/components/data-entry/ReadingCard.tsx:215,250` | `bg-red-50`, `bg-red-500` | `--destructive` / error surface |
| `src/components/Map/MapFilters.tsx:62,79,87` | `#ccc`, `#3b82f6`, `#fff` | `--blue-pale` / `--primary` / `--card` |
| `src/components/ui/chart.tsx:53`, `src/components/ui/toast.tsx:78` | `#ccc`/`#fff`, `text-red-300/red-50` | shadcn vendor defaults (low priority) |

---

## 7. Gaps & duplicates

### Used but **undefined**
- **`green-pale`** — `bg-green-pale` / `border-green-pale` appear in 5 files (`SubmissionTableRow.tsx:130`, `AdminUserDetail.tsx:140`, `AdminSubmissionQueue.tsx:102`, `SubmissionDetails.tsx:95`). There is **no** `--green-pale` and no `green-pale` in `tailwind.config.ts` → these classes resolve to nothing (no background/border rendered).

### Defined but **unused** (0 references in `src/**` outside index.css)
- `--cream` (light `#faf8f3` / dark `#0d1a24`) — never consumed.
- `--action-danger` — defined, never referenced.
- `--score-good`, `--score-average`, `--score-excellent` — the score-badge path uses `bg-green-fresh` / `bg-gold` / `bg-green-mid` instead, so these three tier tokens are unused (`--score-poor` is used).
- `--badge-gold-bg`, `--badge-gold-text`, `--badge-poor-bg` — unused (`--badge-amber-*` used once).
- `--on-bg-faint` — referenced once at most.
- `sidebar-*` (8 tokens) — only referenced by `src/components/ui/sidebar.tsx` (the shadcn component), which does not appear to be mounted in the app.

### Near-duplicate / identical values
- `--green-mid` (`#1f6b3f`) **===** `--score-excellent` (`#1f6b3f`) in light (two names, same colour; both flip to `#2a9460` in dark).
- `--gold` (`#e1b12c`) **===** `--score-average` (`#e1b12c`) in both themes.
- `--orange` (`#eb6e24`) **===** `--action-primary` (`#eb6e24`) **===** `--primary` (`hsl(22 83% 53%)` = `#eb6e24`) in light — three names for the CTA orange.
- `--blue-mid` (`#5787a1`) **===** `--background` (`hsl(201 30% 49%)`) **===** `--sidebar-background` in light.
- `--blue-pale` (`#dde8f0`) ≈ `--border` / `--input` (`hsl(205 39% 90%)`) — borders derive from blue-pale.
- `--blue-mist` (`#eef4f8`) vs `--surface-canvas` (`#eef3f6`) — **one digit apart** in light (`f8` vs `f6`); diverge in dark (`#132130` vs `#0d1a24`).
- `--rank-1-bg` (`#fbbf24`) vs `--gold` (`#e1b12c`) — both amber/gold, different values.

### Light tokens with no dark counterpart
- `--on-bg-text/body/subtle/muted/faint` (all 5), `--safe-*`, `--font-*`, `--radius` — no `.dark` override (constant by design for the first five; structural for the rest).

### Conflicting purposes
- **Two score palettes coexist:** the CSS `--score-*` tokens (`#d9772c` / `#e1b12c` / `#6fae3f` / `#1f6b3f`) and `getBrixColor.colorMap.hex` (`#c0392b` / `#c9a84c` / `#40916c` / `#2d6a4f`). Badges use the token-backed class map; map markers and inline `tierColor` use the hex map — so the same tier renders different colours depending on surface.
- **danger / destructive / poor overlap:** `--action-danger` = `var(--score-poor)` (`#d9772c`), while `--destructive` is `hsl(26 70% 51%)` (≈ `#d9772c`) — three tokens for roughly the same red-orange, defined independently.
- `--score-good` token is `#6fae3f`, but the "good" badge resolves to `--green-fresh` (`#639647`) via the class map — the tier token and the rendered colour disagree.
