import { describe, expect, it } from 'vitest'
import { convolve3x3, pad, PRESETS, type FilterChannels } from './filters'
import { createRaster } from './image'

const RGB: FilterChannels = { r: true, g: true, b: true, a: false }

function grid(w: number, h: number, f: (x: number, y: number) => number, alpha = 255) {
  const img = createRaster(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) img.data.set([f(x, y), f(x, y), f(x, y), alpha], (y * w + x) * 4)
  return img
}
const reds = (img: { data: Uint8ClampedArray }) =>
  Array.from(img.data.filter((_, i) => i % 4 === 0))

describe('pad', () => {
  it('modes at corners; size +2', () => {
    const img = grid(2, 2, (x, y) => 10 + x + 2 * y)
    const b = pad(img, 1, 'black')
    expect([b.width, b.height]).toEqual([4, 4])
    expect(b.data[0]).toBe(0)
    expect(b.data[3]).toBe(255) // padding is opaque
    expect(pad(img, 1, 'white').data[0]).toBe(255)
    const r = pad(img, 1, 'replicate')
    expect(reds(r)).toEqual([10, 10, 11, 11, 10, 10, 11, 11, 12, 12, 13, 13, 12, 12, 13, 13])
  })
})

describe('convolve3x3', () => {
  it('identity equals input; size kept; input unchanged', () => {
    const img = grid(3, 2, (x, y) => x * 40 + y * 7)
    const copy = img.data.slice()
    const out = convolve3x3(img, PRESETS.identity.kernel, RGB, 'black')
    expect(out.data).toEqual(img.data)
    expect(img.data).toEqual(copy)
  })
  it('box on constant with replicate = constant; with black darkens edges', () => {
    const img = grid(4, 4, () => 90)
    expect(
      reds(convolve3x3(img, PRESETS.box.kernel, RGB, 'replicate')).every((v) => v === 90),
    ).toBe(true)
    expect(reds(convolve3x3(img, PRESETS.box.kernel, RGB, 'black'))[0]).toBe(40) // 4·90/9
  })
  it('gaussian spreads an impulse', () => {
    const img = grid(3, 3, (x, y) => (x === 1 && y === 1 ? 160 : 0))
    expect(reds(convolve3x3(img, PRESETS.gaussian.kernel, RGB, 'black'))).toEqual([
      10, 20, 10, 20, 40, 20, 10, 20, 10,
    ])
  })
  it('sharpen; prewitt offset centres on grey', () => {
    const img = grid(3, 1, (x) => (x === 1 ? 100 : 50))
    expect(reds(convolve3x3(img, PRESETS.sharpen.kernel, RGB, 'replicate'))).toEqual([0, 200, 0])
    const spike = grid(3, 3, (x, y) => (x === 1 && y === 1 ? 255 : 0))
    expect(reds(convolve3x3(spike, PRESETS.sharpen.kernel, RGB, 'black'))[4]).toBe(255) // 1275 clamped
    expect(reds(convolve3x3(spike, PRESETS.sharpen.kernel, RGB, 'black'))[1]).toBe(0) // −255 clamped
    const step = grid(4, 3, (x) => (x < 2 ? 0 : 30))
    const px = reds(convolve3x3(step, PRESETS['prewitt-x'].kernel, RGB, 'replicate'))
    expect(px.slice(4, 8)).toEqual([128, 218, 218, 128])
  })
  it('channel selection; alpha untouched by default', () => {
    const img = createRaster(1, 1)
    img.data.set([10, 20, 30, 40])
    const out = convolve3x3(
      img,
      PRESETS.box.kernel,
      { r: true, g: false, b: false, a: false },
      'white',
    )
    expect(Array.from(out.data)).toEqual([Math.round((10 + 8 * 255) / 9), 20, 30, 40])
  })
  it('tie rounds half up', () => {
    const img = createRaster(1, 1)
    img.data.set([5, 0, 0, 255])
    // 5/2 = 2.5 → 3 (Uint8ClampedArray would give 2)
    const out = convolve3x3(
      img,
      { weights: [0, 0, 0, 0, 1, 0, 0, 0, 0], divisor: 2, offset: 0 },
      RGB,
      'black',
    )
    expect(out.data[0]).toBe(3)
  })
})
