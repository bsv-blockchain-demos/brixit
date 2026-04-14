# BRIXIT — Project Rules

BRIXIT is a citizen science platform for collecting and visualizing BRIX (sugar content) data in agriculture and sustainability. Mobile-first, map-driven, community-oriented.

## Design System

- **All colors go through CSS custom properties** defined in `src/index.css`. Never hard-code Tailwind color utilities like `bg-green-600` or `text-blue-500` — always use the semantic tokens (`bg-primary`, `text-muted-foreground`, etc.) mapped through `tailwind.config.ts`.
- If a new color role is needed, add a CSS custom property to `src/index.css` (both `:root` and `.dark`), wire it through `tailwind.config.ts`, then use the Tailwind class.

## Typography

- Font pairing TBD — will be decided during the UI uplift. Once chosen, the display + body fonts will be documented here and loaded in `index.html`.
- Until then: do not introduce new font families without team agreement.

## Components

- Use existing **shadcn/ui** components from `src/components/ui/`. The project has 50+ components already installed.
- Do not create parallel component libraries or duplicate primitives that shadcn already provides.
- Compose larger patterns from shadcn primitives rather than building from scratch.

## Animation & Motion

- Use **framer-motion** (already installed) for page transitions, entrance animations, and micro-interactions.
- Prefer orchestrated, intentional animations (staggered reveals, scroll-triggered entrances) over scattered, gratuitous motion.
- Keep durations snappy for mobile: 150–300ms for micro-interactions, 300–500ms for page transitions.

## Frontend Design Skill

Detailed design guidance lives in `.claude/skills/frontend-design/SKILL.md`. It activates automatically when doing frontend work and provides opinionated direction on typography, color, motion, and spatial composition. Follow its principles, but always defer to the project-specific rules above when they conflict.

## Key Files Reference

| Area | Files |
|------|-------|
| Theme/colors | `src/index.css`, `tailwind.config.ts` |
| Font loading | `index.html` |
| Layout shell | `src/components/Layout/Header.tsx` |
| Auth flow | `src/pages/WalletLogin.tsx`, `src/pages/CreateAccount.tsx` |
| Core pages | `src/pages/Leaderboard.tsx`, `src/pages/MapView.tsx`, `src/pages/DataBrowser.tsx` |
| UI primitives | `src/components/ui/` (shadcn/ui) |
