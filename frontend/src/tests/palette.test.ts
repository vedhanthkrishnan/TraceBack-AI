/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { P } from '../lib/palette'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// vitest runs from the frontend root
const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')
const token = (name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1]?.toLowerCase()

describe('palette', () => {
  it.each([
    ['bg', P.bg], ['sidebar', P.sidebar], ['surface', P.surface], ['elevated', P.elevated],
    ['line', P.line], ['line-strong', P.lineStrong], ['ink', P.ink], ['muted', P.muted], ['faint', P.faint],
    ['wine', P.wine], ['red', P.red], ['blush', P.blush], ['peach', P.peach], ['amber', P.amber], ['sage', P.sage],
    ['accent', P.wine], ['accent-2', P.wineText], ['on-accent', P.surface],
    ['healthy', P.sage], ['healthy-fg', P.sageText], ['watch', P.amber], ['watch-fg', P.amberText],
    ['critical', P.red], ['critical-fg', P.redText], ['unknown', P.unknown], ['idle', P.idleBar],
  ])('CSS token --color-%s matches palette.ts', (name, value) => {
    expect(token(name)).toBe(value.toLowerCase())
  })

  it('keeps the five brand colours sampled from the red colour card', () => {
    expect([P.wine, P.red, P.blush, P.peach, P.amber]).toEqual(['#8A1820', '#E83E3E', '#F5E6DF', '#FEC097', '#DA7702'])
  })
})
