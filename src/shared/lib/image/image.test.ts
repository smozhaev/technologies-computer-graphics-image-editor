import { describe, expect, it } from 'vitest'
import {
  assertRaster,
  cloneRaster,
  createRaster,
  hasTransparency,
  isGrayLayout,
  layoutChannelCount,
  layoutHasAlpha,
  toByte,
  type RasterImage,
} from './image'

describe('createRaster', () => {
  it('allocates zero-filled RGBA buffer', () => {
    const img = createRaster(2, 3)
    expect(img.data.length).toBe(24)
    expect(img.data.every((v) => v === 0)).toBe(true)
  })
  it('is backed by its own ArrayBuffer', () => {
    const img = createRaster(3, 2)
    expect(img.data.buffer.byteLength).toBe(24)
    expect(img.data.byteOffset).toBe(0)
  })
  it.each([
    [0, 1],
    [-1, 2],
    [1.5, 2],
  ])('throws on bad size %s×%s', (w, h) => {
    expect(() => createRaster(w, h)).toThrow()
  })
})

describe('cloneRaster', () => {
  it('returns an independent copy', () => {
    const src = createRaster(1, 1)
    src.data[0] = 10
    const copy = cloneRaster(src)
    expect(copy.data).not.toBe(src.data)
    expect(Array.from(copy.data)).toEqual(Array.from(src.data))
    copy.data[0] = 99
    expect(src.data[0]).toBe(10)
  })
})

describe('assertRaster', () => {
  it('passes for valid 1×1', () => {
    expect(() => assertRaster(createRaster(1, 1))).not.toThrow()
  })
  it('throws on length mismatch', () => {
    const bad: RasterImage = { width: 2, height: 2, data: new Uint8ClampedArray(4) }
    expect(() => assertRaster(bad)).toThrow()
  })
  it('throws on NaN size', () => {
    const bad: RasterImage = { width: NaN, height: 1, data: new Uint8ClampedArray(4) }
    expect(() => assertRaster(bad)).toThrow()
  })
})

describe('hasTransparency', () => {
  it('false when all alpha 255, true with one 254; input unchanged', () => {
    const img = createRaster(2, 1)
    img.data.fill(255)
    const before = img.data.slice()
    expect(hasTransparency(img)).toBe(false)
    img.data[7] = 254
    expect(hasTransparency(img)).toBe(true)
    img.data[7] = 255
    expect(img.data).toEqual(before)
  })
})

describe('toByte', () => {
  it('rounds ties up unlike Uint8ClampedArray', () => {
    expect(toByte(0.5)).toBe(1)
    expect(toByte(2.5)).toBe(3)
    expect(toByte(254.5)).toBe(255)
    const arr = new Uint8ClampedArray(1)
    arr[0] = 2.5
    expect(arr[0]).toBe(2)
  })
  it('clamps and maps NaN to 0', () => {
    expect(toByte(-3)).toBe(0)
    expect(toByte(300)).toBe(255)
    expect(toByte(NaN)).toBe(0)
  })
})

describe('layout helpers', () => {
  it('cover all layouts', () => {
    expect(layoutHasAlpha('gray')).toBe(false)
    expect(layoutHasAlpha('gray-alpha')).toBe(true)
    expect(layoutHasAlpha('rgb')).toBe(false)
    expect(layoutHasAlpha('rgba')).toBe(true)
    expect(isGrayLayout('gray')).toBe(true)
    expect(isGrayLayout('rgba')).toBe(false)
    expect([
      layoutChannelCount('gray'),
      layoutChannelCount('gray-alpha'),
      layoutChannelCount('rgb'),
      layoutChannelCount('rgba'),
    ]).toEqual([1, 2, 3, 4])
  })
})
