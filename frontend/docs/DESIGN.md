# TraceBack design system

Bright "macaron" palette sampled from the team's colour card, on a light sky-blue base, with ideas from landonorris.com.
Tokens live in **two places that must stay in sync**: `src/styles/globals.css` (`@theme`, used by Tailwind classes)
and `src/lib/palette.ts` (`P`, used by Recharts/SVG). `src/tests/palette.test.ts` fails if they drift.
**To swap in a new palette:** edit those two files (and the test's expected values), then `npm test` and look at Fleet, Machine and Benchmarks.

## Palette

| Colour | Hex | Role |
|---|---|---|
| Green | `#5FA65A` | Healthy |
| Teal | `#01B4BB` | brand, health trend line, bars |
| Yellow | `#F5D51E` | interaction fills — primary buttons, active nav pill (text on it: `on-accent`, navy) |
| Orange | `#FB8926` | Watch |
| Coral | `#FA5456` | Critical |

Text-safe tints (the bright fills are too light for small text on white — WCAG AA): `healthy-fg #2C7A34`, `watch-fg #A85200`,
`critical-fg #C4283A`, deep teal `accent-2 #07707B` (links, focus ring). Use `text-*-fg` for text, plain tokens for fills/borders/tints.

Neutrals (derived from the card's sky background): `bg #D2E6F3`, `sidebar #F3F9FD`, `surface #FFFFFF`, `elevated #EAF3FA`,
`line #BCD5E6`, `line-strong #8FB4CE`, `ink #0E2B3C`, `muted #3A586B`, `faint #4B6A7E`, `idle #B7CCDB`.

Rules
- Risk is never colour-only: every state also has a label and an icon (`src/lib/risk.ts`).
- Never hard-code hex in components — add it to both token files instead.

## Copy rule
Keep screens quiet: no page subtitles, eyebrows or explanatory paragraphs. Only keep text that protects honesty:
dataset provenance pill ("Synthetic fleet"), "unvalidated" RUL, "configured" thresholds, "pattern overlap, not probability",
"leading indicators, not a confirmed cause", Copilot "Offline engine" + backend limitations, benchmark environment warnings.

## Landonorris.com ideas applied
Huge condensed all-caps display type (`.display`), lowercase micro-labels (`.micro`), a "highest risk" hero (`PriorityHero`)
next to an "Ask the copilot" tile, pill navigation, lift-on-hover cards (`.tb-lift`), page entrance (`.tb-rise`, off under reduced motion).
Not built yet: scroll-driven intro, archive-style gallery of historical failures, image-led panels.
Note: `.display`/`.micro` change only how text looks (CSS case), not the DOM text.
