# TraceBack design system

Warm "red" palette sampled from the team's colour card, on a soft blush base, with ideas from landonorris.com.
Tokens live in **two places that must stay in sync**: `src/styles/globals.css` (`@theme`, used by Tailwind classes)
and `src/lib/palette.ts` (`P`, used by Recharts/SVG). `src/tests/palette.test.ts` fails if they drift.
**To swap in a new palette:** edit those two files (and the test's expected values), then `npm test` and look at Fleet, Machine and Benchmarks.

## Palette

| Colour | Hex | Role |
|---|---|---|
| Wine | `#8A1820` | brand, health trend line, interaction fills (primary buttons, active nav pill; text on it: `on-accent`, white) |
| Red | `#E83E3E` | Critical |
| Blush | `#F5E6DF` | soft surfaces and tints |
| Peach | `#FEC097` | highlights, glows, text selection |
| Amber | `#DA7702` | Watch |
| Sage | `#5F8F66` | Healthy (the card has no green, so this muted sage sits beside the reds) |

Text-safe tints (the bright fills are too light for small text on white, WCAG AA): `healthy-fg #2F6B3A`, `watch-fg #94500A`,
`critical-fg #C2262E`, `accent-2 #A3202A` (links, focus ring). Use `text-*-fg` for text, plain tokens for fills/borders/tints.

Neutrals (derived from the card's background): `bg #FBF4EF`, `sidebar #FFFAF7`, `surface #FFFFFF`, `elevated #F8ECE6`,
`line #ECD6CC`, `line-strong #D3A89A`, `ink #32312D`, `muted #5C4E49`, `faint #6B5B55`, `idle #E6D2C8`.

Type: Fraunces (serif) for headlines and big numerals via `.display`; Archivo for UI text. Cards use soft wine-tinted shadows
(`.tb-card`, `.tb-lift`) and the page has two faint peach/red glows behind the content.

Rules
- Risk is never colour-only: every state also has a label and an icon (`src/lib/risk.ts`).
- Never hard-code hex in components — add it to both token files instead.

## Copy rule
Keep screens quiet: no page subtitles, eyebrows or explanatory paragraphs. Only keep text that protects honesty:
dataset provenance pill ("Synthetic fleet"), "unvalidated" RUL, "configured" thresholds, "pattern overlap, not probability",
"leading indicators, not a confirmed cause", Copilot "Offline engine" + backend limitations, benchmark environment warnings.

## Landonorris.com ideas applied
Big serif display type (`.display`), lowercase micro-labels (`.micro`), a "highest risk" hero (`PriorityHero`)
next to an "Ask the copilot" tile, pill navigation, lift-on-hover cards (`.tb-lift`), page entrance (`.tb-rise`, off under reduced motion).
Not built yet: scroll-driven intro, archive-style gallery of historical failures, image-led panels.
Note: `.display`/`.micro` change only how text looks (CSS case), not the DOM text.
