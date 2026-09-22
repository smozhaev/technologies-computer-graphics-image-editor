import { describe, expect, it } from 'vitest'
import {
  imageOffset,
  imageToScreen,
  screenToImage,
  type ViewState,
  type Viewport,
} from './geometry'

const view = (zoom = 1, scrollX = 0, scrollY = 0): ViewState => ({ zoom, scrollX, scrollY })
const vp = (cssWidth: number, cssHeight: number, dpr = 1): Viewport => ({
  cssWidth,
  cssHeight,
  dpr,
})

describe('geometry', () => {
  it('centres a smaller image', () => {
    const img = { width: 10, height: 10 }
    expect(screenToImage({ x: 50, y: 50 }, view(), vp(100, 100), img)).toEqual({ x: 5, y: 5 })
  })
  it('floors the centring offset', () => {
    expect(imageOffset(view(), vp(101, 100), { width: 10, height: 10 })).toEqual({ x: 45, y: 45 })
  })
  it('applies scroll for a larger image', () => {
    const img = { width: 500, height: 500 }
    expect(screenToImage({ x: 0, y: 0 }, view(1, 10, 5), vp(100, 100), img)).toEqual({
      x: 10,
      y: 5,
    })
  })
  it('mixed: wider but shorter', () => {
    const off = imageOffset(view(1, 7, 99), vp(100, 100), { width: 300, height: 40 })
    expect(off).toEqual({ x: -7, y: 30 })
  })
  it('outside the image → null, right/bottom edge exclusive', () => {
    const img = { width: 10, height: 10 }
    const v = vp(100, 100)
    expect(screenToImage({ x: 44, y: 50 }, view(), v, img)).toBeNull()
    expect(screenToImage({ x: 50, y: 44 }, view(), v, img)).toBeNull()
    expect(screenToImage({ x: 55, y: 50 }, view(), v, img)).toBeNull()
    expect(screenToImage({ x: 50, y: 55 }, view(), v, img)).toBeNull()
    expect(screenToImage({ x: 54.9, y: 50 }, view(), v, img)).toEqual({ x: 9, y: 5 })
  })
  it('dpr does not change CSS mapping', () => {
    const img = { width: 10, height: 10 }
    expect(screenToImage({ x: 50, y: 50 }, view(), vp(100, 100, 2), img)).toEqual(
      screenToImage({ x: 50, y: 50 }, view(), vp(100, 100, 1), img),
    )
  })
  it.each([1, 2, 0.5])('round-trips pixel centres at zoom %s', (zoom) => {
    const img = { width: 40, height: 30 }
    const v = vp(64, 48)
    const vs = view(zoom, 3, 2)
    for (const [i, j] of [
      [0, 0],
      [5, 7],
      [39, 29],
    ] as const) {
      const s = imageToScreen({ x: i + 0.5, y: j + 0.5 }, vs, v, img)
      expect(screenToImage(s, vs, v, img)).toEqual({ x: i, y: j })
    }
  })
})
