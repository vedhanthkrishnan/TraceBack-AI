/**
 * TraceBack colour palette — single source of truth for colours used in JS (charts, SVG).
 * The same values are declared as CSS tokens in styles/globals.css (@theme); keep the two in sync
 * (src/tests/palette.test.ts fails if they drift).
 *
 * Brand palette ("macaron", sampled from the supplied colour card):
 *   green #5FA65A · teal #01B4BB · yellow #F5D51E · orange #FB8926 · coral #FA5456
 * Neutrals are a light sky-blue family derived from the card's background.
 *
 * Semantics (see docs/DESIGN.md):
 *   green = Healthy   orange = Watch   coral = Critical   teal = brand / health trend
 *   yellow = interaction fills (primary buttons, active nav)   navy ink = text and selection strokes
 */
export const P = {
  green: '#5FA65A',
  teal: '#01B4BB',
  yellow: '#F5D51E',
  orange: '#FB8926',
  coral: '#FA5456',
  /** darker tints used only for small TEXT, to reach WCAG AA on white / sky surfaces */
  greenText: '#2C7A34',
  orangeText: '#A85200',
  coralText: '#C4283A',
  tealText: '#07707B',
  unknown: '#5B7184',

  bg: '#D2E6F3',
  sidebar: '#F3F9FD',
  surface: '#FFFFFF',
  elevated: '#EAF3FA',
  line: '#BCD5E6',
  lineStrong: '#8FB4CE',
  ink: '#0E2B3C',
  muted: '#3A586B',
  faint: '#4B6A7E',
  /** idle bar colour for sensors within their normal range */
  idleBar: '#B7CCDB',
} as const

export type PaletteKey = keyof typeof P
