import { describe, expect, it } from 'vitest'
import { ALL_CHANNELS_ON } from './channels'
import { imageToScreen } from './geometry'
import { createRaster, type ImageDocument, type RasterImage } from './image'
import { buildLevelsLuts, identitySettings } from './levels'
import { CHECKER_DARK, CHECKER_LIGHT, renderView, VIEW_BACKGROUND } from './render'

function doc(...images: RasterImage[]): ImageDocument {
  return {
    source: {
      format: 'png',
      fileName: 'a',
      bitDepth: 32,
      depthLabel: '',
      sourceWidth: 1,
      sourceHeight: 1,
      gb7HasMask: false,
    },
    versions: images.map((image, i) => ({
      id: i + 1,
      label: 'v',
      image,
      layout: 'rgba',
      levelMax: 255,
    })),
    currentIndex: images.length - 1,
  }
}
function solid(w: number, h: number, rgba: number[]) {
  const img = createRaster(w, h)
  for (let i = 0; i < w * h; i++) img.data.set(rgba, i * 4)
  return img
}
const view = (scrollX = 0, scrollY = 0) => ({ zoom: 1, scrollX, scrollY })
const at = (r: RasterImage, x: number, y: number) =>
  Array.from(r.data.slice((y * r.width + x) * 4, (y * r.width + x) * 4 + 4))
const BG = [VIEW_BACKGROUND.r, VIEW_BACKGROUND.g, VIEW_BACKGROUND.b, 255]

describe('renderView', () => {
  it('output size = css × dpr; zero viewport → 0×0', () => {
    const out = renderView(doc(solid(1, 1, [0, 0, 0, 255])), view(), {
      cssWidth: 100,
      cssHeight: 50,
      dpr: 2,
    })
    expect([out.width, out.height, out.data.length]).toEqual([200, 100, 200 * 100 * 4])
    expect(
      renderView(doc(solid(1, 1, [0, 0, 0, 255])), view(), { cssWidth: 0, cssHeight: 5, dpr: 1 })
        .width,
    ).toBe(0)
  })
  it('1×1 at dpr 2 covers exactly 2×2 device pixels', () => {
    const out = renderView(doc(solid(1, 1, [9, 8, 7, 255])), view(), {
      cssWidth: 4,
      cssHeight: 4,
      dpr: 2,
    })
    let count = 0
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (at(out, x, y)[0] === 9) count++
    expect(count).toBe(4)
    expect(at(out, 0, 0)).toEqual(BG)
  })
  it('3×2 placed at imageToScreen origin, row-major', () => {
    const img = createRaster(3, 2)
    for (let i = 0; i < 6; i++) img.data.set([i * 10, 0, 0, 255], i * 4)
    const vp = { cssWidth: 9, cssHeight: 6, dpr: 1 }
    const o = imageToScreen({ x: 0, y: 0 }, view(), vp, img)
    const out = renderView(doc(img), view(), vp)
    expect(at(out, o.x, o.y)[0]).toBe(0)
    expect(at(out, o.x + 2, o.y)[0]).toBe(20)
    expect(at(out, o.x, o.y + 1)[0]).toBe(30)
    expect(at(out, 0, 0)).toEqual(BG)
  })
  it('transparent → checkerboard; alpha always 255; semi composite rounds', () => {
    const out = renderView(doc(solid(16, 8, [0, 0, 0, 0])), view(), {
      cssWidth: 16,
      cssHeight: 8,
      dpr: 1,
    })
    expect(at(out, 0, 0)).toEqual([CHECKER_LIGHT, CHECKER_LIGHT, CHECKER_LIGHT, 255])
    expect(at(out, 8, 0)).toEqual([CHECKER_DARK, CHECKER_DARK, CHECKER_DARK, 255])
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(255)
    const semi = renderView(doc(solid(16, 8, [255, 255, 255, 128])), view(), {
      cssWidth: 16,
      cssHeight: 8,
      dpr: 1,
    })
    expect(at(semi, 8, 0)[0]).toBe(230) // (255·128 + 204·127)/255 = 229.6
  })
  it('scroll offsets at dpr 1 and 2', () => {
    const img = createRaster(50, 50)
    for (let y = 0; y < 50; y++)
      for (let x = 0; x < 50; x++) img.data.set([x, y, 0, 255], (y * 50 + x) * 4)
    const a = renderView(doc(img), view(10, 5), { cssWidth: 20, cssHeight: 20, dpr: 1 })
    expect(at(a, 0, 0).slice(0, 2)).toEqual([10, 5])
    const b = renderView(doc(img), view(10, 5), { cssWidth: 20, cssHeight: 20, dpr: 2 })
    expect([at(b, 0, 0), at(b, 1, 1)].map((p) => p.slice(0, 2))).toEqual([
      [10, 5],
      [10, 5],
    ])
  })
  it('uses current version; input unchanged', () => {
    const first = solid(1, 1, [1, 1, 1, 255])
    const second = solid(1, 1, [2, 2, 2, 255])
    const copy = second.data.slice()
    const out = renderView(doc(first, second), view(), { cssWidth: 1, cssHeight: 1, dpr: 1 })
    expect(at(out, 0, 0)[0]).toBe(2)
    expect(second.data).toEqual(copy)
  })
  it('channel mask stage: green off, only alpha', () => {
    const v = { cssWidth: 1, cssHeight: 1, dpr: 1 }
    const img = solid(1, 1, [10, 20, 30, 255])
    expect(
      at(renderView(doc(img), view(), v, { channels: { ...ALL_CHANNELS_ON, g: false } }), 0, 0),
    ).toEqual([10, 0, 30, 255])
    const semi = solid(1, 1, [10, 20, 30, 77])
    const onlyA = { ...ALL_CHANNELS_ON, r: false, g: false, b: false }
    expect(at(renderView(doc(semi), view(), v, { channels: onlyA }), 0, 0)).toEqual([
      77, 77, 77, 255,
    ])
  })
  it('levels stage applies LUTs before the channel mask', () => {
    const v = { cssWidth: 1, cssHeight: 1, dpr: 1 }
    const s = identitySettings(255)
    s.master = { black: 0, gamma: 1, white: 128 }
    const out = renderView(doc(solid(1, 1, [64, 10, 200, 255])), view(), v, {
      levels: buildLevelsLuts(s, 255),
      channels: { ...ALL_CHANNELS_ON, g: false },
    })
    expect(at(out, 0, 0)).toEqual([128, 0, 255, 255])
  })
  it('zoom 2 nearest duplicates; bilinear blends; zoom 0.5 averages', () => {
    const img = createRaster(2, 1)
    img.data.set([0, 0, 0, 255, 200, 0, 0, 255])
    const v = { cssWidth: 4, cssHeight: 2, dpr: 1 }
    const z2 = { zoom: 2, scrollX: 0, scrollY: 0 }
    const near = renderView(doc(img), z2, v, { interpolation: 'nearest' })
    expect([0, 1, 2, 3].map((x) => at(near, x, 0)[0])).toEqual([0, 0, 200, 200])
    const bil = renderView(doc(img), z2, v, { interpolation: 'bilinear' })
    expect([0, 1, 2, 3].map((x) => at(bil, x, 0)[0])).toEqual([0, 50, 150, 200])
    const half = renderView(
      doc(createRaster(4, 4)),
      { zoom: 0.5, scrollX: 0, scrollY: 0 },
      { cssWidth: 2, cssHeight: 2, dpr: 1 },
    )
    expect([half.width, half.height]).toEqual([2, 2])
  })
  it('source stage replaces the version image when sizes match', () => {
    const v = { cssWidth: 1, cssHeight: 1, dpr: 1 }
    const base = solid(1, 1, [1, 1, 1, 255])
    const filtered = solid(1, 1, [99, 99, 99, 255])
    expect(at(renderView(doc(base), view(), v, { source: filtered }), 0, 0)[0]).toBe(99)
    expect(
      at(renderView(doc(base), view(), v, { source: solid(2, 1, [5, 5, 5, 255]) }), 0, 0)[0],
    ).toBe(1)
  })
})
