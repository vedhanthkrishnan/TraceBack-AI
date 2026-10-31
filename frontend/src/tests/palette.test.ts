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
    ['green', P.green], ['teal', P.teal], ['yellow', P.yellow], ['orange', P.orange], ['coral', P.coral],
    ['accent', P.yellow], ['accent-2', P.tealText], ['on-accent', P.ink],
    ['healthy', P.green], ['healthy-fg', P.greenText], ['watch', P.orange], ['watch-fg', P.orangeText],
    ['critical', P.coral], ['critical-fg', P.coralText], ['unknown', P.unknown], ['idle', P.idleBar],
  ])('CSS token --color-%s matches palette.ts', (name, value) => {
    expect(token(name)).toBe(value.toLowerCase())
  })

  it('keeps the five brand colours sampled from the macaron colour card', () => {
    expect([P.green, P.teal, P.yellow, P.orange, P.coral]).toEqual(['#5FA65A', '#01B4BB', '#F5D51E', '#FB8926', '#FA5456'])
  })
})
