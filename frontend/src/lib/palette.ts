/**
 * TraceBack colour palette: single source of truth for colours used in JS (charts, SVG).
 * The same values are declared as CSS tokens in styles/globals.css (@theme); keep the two in sync
 * (src/tests/palette.test.ts fails if they drift).
 *
 * Brand palette ("red", sampled from the supplied colour card):
 *   wine #8A1820 · red #E83E3E · blush #F5E6DF · peach #FEC097 · amber #DA7702
 * Neutrals are a warm blush family derived from the card's background. The card has no green, so
 * Healthy uses a muted sage that sits well beside the reds.
 *
 * Semantics (see docs/DESIGN.md):
 *   sage = Healthy   amber = Watch   red = Critical   wine = brand / health trend / interaction fills
 *   peach = highlights   warm charcoal ink = text and selection strokes
 */
export const P = {
  wine: '#8A1820',
  red: '#E83E3E',
  blush: '#F5E6DF',
  peach: '#FEC097',
  amber: '#DA7702',
  sage: '#5F8F66',
  /** darker tints used only for small TEXT, to reach WCAG AA on white / blush surfaces */
  sageText: '#2F6B3A',
  amberText: '#94500A',
  redText: '#C2262E',
  wineText: '#A3202A',
  unknown: '#6F6560',

  bg: '#FBF4EF',
  sidebar: '#FFFAF7',
  surface: '#FFFFFF',
  elevated: '#F8ECE6',
  line: '#ECD6CC',
  lineStrong: '#D3A89A',
  ink: '#32312D',
  muted: '#5C4E49',
  faint: '#6B5B55',
  /** idle bar colour for sensors within their normal range */
  idleBar: '#E6D2C8',
} as const

export type PaletteKey = keyof typeof P
