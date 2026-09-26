import { describe, expect, it } from 'vitest'
import { createRaster } from '../image'
import { decodeGb7, encodeGb7, Gb7Error } from './gb7'

function gb7(w: number, h: number, pixels: number[], flags = 0, version = 1): Uint8Array {
  return new Uint8Array([
    0x47,
    0x42,
    0x37,
    0x1d,
    version,
    flags,
    w >> 8,
    w & 255,
    h >> 8,
    h & 255,
    0,
    0,
    ...pixels,
  ])
}

const px = (img: { data: Uint8ClampedArray }, i: number) =>
  Array.from(img.data.slice(i * 4, i * 4 + 4))

describe('decodeGb7', () => {
  it('2×2 without mask scales grey', () => {
    const { image, hasMask } = decodeGb7(gb7(2, 2, [0, 64, 127, 1]))
    expect(hasMask).toBe(false)
    expect([0, 1, 2, 3].map((i) => px(image, i))).toEqual([
      [0, 0, 0, 255],
      [129, 129, 129, 255],
      [255, 255, 255, 255],
      [2, 2, 2, 255],
    ])
  })
  it('mask flag: bit7 → alpha', () => {
    const { image, hasMask } = decodeGb7(gb7(2, 1, [0x80 | 10, 10], 1))
    expect(hasMask).toBe(true)
    expect(px(image, 0)[3]).toBe(255)
    expect(px(image, 1)[3]).toBe(0)
  })
  it('flag clear ignores bit7; reserved bits and trailing bytes ignored', () => {
    const { image, hasMask } = decodeGb7(gb7(1, 1, [0x80 | 127, 9, 9], 0b1111_1110))
    expect(hasMask).toBe(false)
    expect(px(image, 0)).toEqual([255, 255, 255, 255])
  })
  it('input unchanged', () => {
    const bytes = gb7(2, 1, [5, 6])
    const copy = bytes.slice()
    decodeGb7(bytes)
    expect(bytes).toEqual(copy)
  })
  it.each([
    ['short', new Uint8Array([0x47, 0x42]), /короткий/],
    ['signature', gb7(1, 1, [0]).map((b, i) => (i === 0 ? 0 : b)), /сигнатура/],
    ['version', gb7(1, 1, [0], 0, 2), /версия/],
    ['zero width', gb7(0, 1, []), /размер/],
    ['zero height', gb7(1, 0, []), /размер/],
  ])('error: %s', (_name, bytes, msg) => {
    expect(() => decodeGb7(bytes)).toThrow(Gb7Error)
    expect(() => decodeGb7(bytes)).toThrow(msg)
  })
  it('huge header with tiny body fails fast without allocating', () => {
    const t = performance.now()
    expect(() => decodeGb7(gb7(65535, 65535, [1, 2, 3]))).toThrow(Gb7Error)
    expect(performance.now() - t).toBeLessThan(50)
  })
  it('truncated body reports byte counts', () => {
    expect(() => decodeGb7(gb7(100, 100, new Array(10).fill(0)))).toThrow(/10000.*10/)
  })
  it('error order: short + bad signature → length error', () => {
    expect(() => decodeGb7(new Uint8Array([1, 2, 3]))).toThrow(/короткий/)
    expect(() => decodeGb7(gb7(1, 1, [0], 0, 9).map((b, i) => (i === 1 ? 0 : b)))).toThrow(
      /сигнатура/,
    )
  })
})

describe('encodeGb7', () => {
  function raster(pixels: number[][], w = pixels.length, h = 1) {
    const img = createRaster(w, h)
    pixels.forEach((p, i) => img.data.set(p, i * 4))
    return img
  }

  it('header bytes exact, big-endian size', () => {
    const out = encodeGb7(createRaster(300, 1))
    expect(Array.from(out.slice(0, 12))).toEqual([
      0x47, 0x42, 0x37, 0x1d, 1, 1, 0x01, 0x2c, 0, 1, 0, 0,
    ])
    expect(out.length).toBe(12 + 300)
  })
  it('BT.601 grey then round(y*127/255)', () => {
    const out = encodeGb7(
      raster([
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [0, 0, 255, 255],
        [128, 128, 128, 255],
      ]),
    )
    // 76.245→38.0 ; 149.685→74.55→75 ; 29.07→14.48→14 ; 128→63.75→64
    expect(Array.from(out.slice(12))).toEqual([38, 75, 14, 64])
  })
  it("mask 'auto': opaque → flag 0; alpha 128..254 → flag 0; alpha <128 → flag 1", () => {
    expect(encodeGb7(raster([[0, 0, 0, 255]]))[5]).toBe(0)
    const semi = encodeGb7(
      raster([
        [0, 0, 0, 200],
        [0, 0, 0, 128],
      ]),
    )
    expect(semi[5]).toBe(0)
    expect(semi[12]! & 0x80).toBe(0)
    const masked = encodeGb7(
      raster([
        [0, 0, 0, 127],
        [0, 0, 0, 128],
      ]),
    )
    expect(masked[5]).toBe(1)
    expect(masked[12]! & 0x80).toBe(0)
    expect(masked[13]! & 0x80).toBe(0x80)
  })
  it("mask 'always' and 'never'", () => {
    const always = encodeGb7(raster([[0, 0, 0, 255]]), { mask: 'always' })
    expect(always[5]).toBe(1)
    expect(always[12]! & 0x80).toBe(0x80)
    const never = encodeGb7(raster([[0, 0, 0, 0]]), { mask: 'never' })
    expect(never[5]).toBe(0)
    expect(never[12]! & 0x80).toBe(0)
  })
  it('rejects side > 65535', () => {
    expect(() => encodeGb7(createRaster(65536, 1))).toThrow(Gb7Error)
  })
  it('input unchanged', () => {
    const img = raster([[10, 20, 30, 40]])
    const copy = img.data.slice()
    encodeGb7(img)
    expect(img.data).toEqual(copy)
  })
})

describe('GB7 round trip', () => {
  it('all 128 grey values, no mask', () => {
    const src = gb7(
      128,
      1,
      Array.from({ length: 128 }, (_, i) => i),
    )
    const back = encodeGb7(decodeGb7(src).image, { mask: 'never' })
    expect(back).toEqual(src)
  })
  it('canonical masked file with mask always', () => {
    const src = gb7(3, 1, [0x80 | 5, 7, 0x80 | 127], 1)
    const back = encodeGb7(decodeGb7(src).image, { mask: 'always' })
    expect(back).toEqual(src)
  })
})
