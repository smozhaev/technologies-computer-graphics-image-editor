import { describe, expect, it } from 'vitest'
import { clampZoom, fitZoom, zoomKeepingCentre } from './fit'

const vp = { cssWidth: 1100, cssHeight: 700, dpr: 1 }

describe('fit and zoom', () => {
  it('fits with 50 px margins and clamps', () => {
    expect(fitZoom({ width: 2000, height: 1000 }, vp)).toBeCloseTo(0.5, 9)
    expect(fitZoom({ width: 10, height: 10 }, vp)).toBe(3)
    expect(fitZoom({ width: 100000, height: 100 }, vp)).toBe(0.12)
    expect(clampZoom(5)).toBe(3)
  })
  it('zoom keeps centre point', () => {
    const img = { width: 2000, height: 2000 }
    const next = zoomKeepingCentre({ zoom: 1, scrollX: 450, scrollY: 650 }, 2, vp, img)
    // centre image point (1000, 1000) → 2000 at zoom 2 → scroll = 2000 − 550, 2000 − 350
    expect(next).toEqual({ zoom: 2, scrollX: 1450, scrollY: 1650 })
    expect(zoomKeepingCentre({ zoom: 1, scrollX: 0, scrollY: 0 }, 0.2, vp, img)).toEqual({
      zoom: 0.2,
      scrollX: 0,
      scrollY: 0,
    })
  })
})

describe('zoomAtPoint', () => {
  it('keeps the image point under the cursor', async () => {
    const { zoomAtPoint } = await import('./fit')
    const img = { width: 2000, height: 2000 }
    // zoom 1, scroll 100: cursor at (50, 60) is over image (150, 160)
    const next = zoomAtPoint({ zoom: 1, scrollX: 100, scrollY: 100 }, 2, vp, img, { x: 50, y: 60 })
    expect(next).toEqual({ zoom: 2, scrollX: 250, scrollY: 260 })
    expect(
      zoomAtPoint({ zoom: 1, scrollX: 0, scrollY: 0 }, 0.2, vp, img, { x: 5, y: 5 }),
    ).toMatchObject({ scrollX: 0, scrollY: 0 })
  })
})
