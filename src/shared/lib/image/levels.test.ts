import { describe, expect, it } from 'vitest'
import { createRaster } from './image'
import {
  applyLevels,
  buildLevelsLuts,
  buildLut,
  gammaToPosition,
  identitySettings,
  positionToGamma,
} from './levels'

describe('levels LUT', () => {
  it('identity', () => {
    const lut = buildLut({ black: 0, gamma: 1, white: 255 }, 255)
    expect(Array.from(lut)).toEqual(Array.from({ length: 256 }, (_, i) => i))
    expect(buildLevelsLuts(identitySettings(255), 255)).toBeNull()
  })
  it('endpoints and linear stretch with explicit rounding', () => {
    const lut = buildLut({ black: 50, gamma: 1, white: 200 }, 255)
    expect([lut[0], lut[50], lut[200], lut[255]]).toEqual([0, 0, 255, 255])
    expect(lut[125]).toBe(128) // 127.5
    // tie 2.5: Math.round → 3, Uint8ClampedArray half-even would give 2
    expect(buildLut({ black: 0, gamma: 1, white: 102 }, 255)[1]).toBe(3)
  })
  it('gamma > 1 brightens midtones, < 1 darkens', () => {
    expect(buildLut({ black: 0, gamma: 2, white: 255 }, 255)[128]).toBe(181)
    expect(buildLut({ black: 0, gamma: 0.5, white: 255 }, 255)[128]).toBe(64)
  })
  it('GB7 range stays on the 7-bit grid', () => {
    const lut = buildLut({ black: 0, gamma: 1.7, white: 127 }, 127)
    const grid = new Set(Array.from({ length: 128 }, (_, v) => Math.round((v * 255) / 127)))
    for (const v of lut) expect(grid.has(v)).toBe(true)
    expect(
      Array.from(buildLut({ black: 0, gamma: 1, white: 127 }, 127)).filter((_, i) => grid.has(i)),
    ).toEqual([...grid])
  })
})

describe('gamma handle position', () => {
  it('γ 1 ↔ middle; γ > 1 left; clamps', () => {
    expect(gammaToPosition({ black: 0, gamma: 1, white: 200 })).toBe(100)
    expect(gammaToPosition({ black: 0, gamma: 2, white: 200 })).toBe(50)
    expect(positionToGamma(100, 0, 200)).toBeCloseTo(1, 9)
    expect(positionToGamma(50, 0, 200)).toBeCloseTo(2, 9)
    expect(positionToGamma(0, 0, 200)).toBe(9.9)
    expect(positionToGamma(200, 0, 200)).toBe(0.1)
  })
})

describe('applyLevels', () => {
  it('per-channel first, then master; alpha; input unchanged', () => {
    const s = identitySettings(255)
    s.r = { black: 0, gamma: 1, white: 128 } // r 64 → 128
    s.master = { black: 0, gamma: 2, white: 255 } // then 128 → 181
    s.a = { black: 100, gamma: 1, white: 255 }
    const luts = buildLevelsLuts(s, 255)!
    const img = createRaster(1, 1)
    img.data.set([64, 0, 255, 100])
    const copy = img.data.slice()
    const out = applyLevels(img, luts)
    expect(Array.from(out.data)).toEqual([181, 0, 255, 0])
    expect(img.data).toEqual(copy)
  })
})
