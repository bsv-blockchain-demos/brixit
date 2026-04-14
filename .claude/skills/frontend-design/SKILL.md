---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of frontend interfaces for BRIXIT — a citizen science platform for food quality measurement. The aesthetic is **clean, professional, agricultural** — think premium farm-to-table brand, not a tech startup.

## Design Identity

BRIXIT's visual language conveys trust, nature, and scientific credibility. Every interface should feel like it was designed by a premium organic food brand's in-house team — warm, grounded, and confident.

**Tone**: Refined and earthy. Not techy, not playful, not corporate. The design should feel like holding a well-made ceramic bowl — simple, warm, purposeful.

## Typography

- **Lora** (serif) for display headings — gives agricultural/scientific gravitas
- **DM Sans** for body text and UI — clean geometric sans that pairs well
- Headings use `font-display` class (maps to Lora via CSS custom properties)
- Body uses the default font stack (maps to DM Sans)
- Never introduce other font families

## Color System

All colors flow through CSS custom properties in `src/index.css`. Never hard-code Tailwind color utilities.

**The palette is a nature-green spectrum with gold accent:**
- Dark end: `--green-deep` (#1a3a2a) — hero, mission, footer backgrounds
- Mid greens: `--green-mid`, `--green-fresh` — buttons, links, accents
- Light end: `--green-pale`, `--green-mist` — card borders, section backgrounds
- Neutral: `--cream` (#faf8f3) — page background
- Text: `--text-dark`, `--text-mid`, `--text-muted` — three-tier text hierarchy
- Accent: `--gold` (#c9a84c) — used for "Good" score tier

**On dark backgrounds**: Body text is `rgba(255,255,255,0.75)`. Emphasized words use `var(--green-light)` with italic. Never use green-light with opacity for body text — it's muddy.

**On light backgrounds**: Use the `--text-dark` / `--text-mid` / `--text-muted` hierarchy. Eyebrow text is always `--green-fresh`.

## Card Patterns

Cards are a core UI element. Follow these established patterns:

- **White cards with green-pale border**: Default for feature tiles, benefits, info cards. Use `bg-white border border-[var(--green-pale)] rounded-2xl shadow-sm`. Add `hover:shadow-md transition-shadow` for interactive cards.
- **Icon badges**: Dark green (`--green-deep`) rounded squares (`rounded-xl`) with white icons inside. Not circles, not colored backgrounds matching the palette.
- **Never use glass/translucent cards on dark backgrounds** — they kill readability. Use solid white with `shadow-lg` instead.

## Layout Principles

- **Left-aligned text by default**. Centered text only for hero CTAs and mission statements.
- **Two-column grids** (`desktop:grid-cols-2`) for text + visual pairs.
- **max-w-5xl** for content sections. Narrower (`max-w-2xl`) for centered mission/CTA blocks.
- **Eyebrow pattern**: Uppercase, `tracking-[0.2em]`, `text-sm`, `font-medium`, `color: var(--green-fresh)`.
- Alternate section backgrounds between `--cream` and `--green-mist`.
- Dark sections use `radial-gradient(ellipse at ..., #244536 0%, var(--green-deep) 70%)`.

## Motion

- Use **framer-motion** (already installed). Prefer `fadeUp` and staggered reveal patterns.
- Respect `prefers-reduced-motion` — disable animations entirely, don't just reduce them.
- Keep it snappy: 150–300ms for micro-interactions, 300–500ms for page transitions.
- One orchestrated entrance per section is better than scattered animations everywhere.

## What to Avoid

- **Generic AI aesthetics**: No purple gradients, no Inter/Roboto, no glass morphism, no gratuitous gradients.
- **Over-designed complexity**: BRIXIT is warm and approachable. Don't add noise textures, grain overlays, or brutalist elements.
- **Competing visual weight**: One hero element per section. Don't let cards, badges, and buttons all scream at once.
- **Tech startup patterns**: No dark mode toggle on landing pages, no "powered by AI" badges, no floating chat widgets.

## Score Visualization

BRIX scores use a strict color convention across all displays:

| Rating | Range | Color |
|--------|-------|-------|
| Excellent | 16+ | `--green-mid` |
| Good | 8–15 | `--gold` |
| Poor | 1–7 | `--score-poor` |

Score numbers always use Lora bold (`font-display font-bold`). Always include `aria-label` with the score value and rating.
