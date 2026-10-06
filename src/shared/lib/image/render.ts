import { isMaskIdentity, maskPixel, type ChannelMask } from './channels'
import { imageToScreen, type ViewState, type Viewport } from './geometry'
import { createRaster, type ImageDocument, type RasterImage } from './image'
import {
  DEFAULT_INTERPOLATOR,
  INTERPOLATORS,
  type InterpolatorId,
  type TapTable,
} from './interpolation'
import type { LevelsLuts } from './levels'

/** CSS px of one checkerboard cell, anchored at the image's top-left corner. */
export const CHECKER_CELL = 8
export const CHECKER_LIGHT = 255
export const CHECKER_DARK = 204
/** Colour outside the image; also the viewport CSS background. */
export const VIEW_BACKGROUND = { r: 36, g: 36, b: 36 } as const

export function backingSize(vp: Viewport): { width: number; height: number } {
  return {
    width: Math.max(0, Math.round(vp.cssWidth * vp.dpr)),
    height: Math.max(0, Math.round(vp.cssHeight * vp.dpr)),
  }
}

interface AxisTable {
  taps: TapTable
  inside: Uint8Array
  parity: Uint8Array
}

/** Per device pixel along one axis: interpolation taps, inside-image flag, checker parity. */
function axisTable(
  deviceLen: number,
  dpr: number,
  origin: number,
  zoom: number,
  imageLen: number,
  method: InterpolatorId,
): AxisTable {
  const coords = new Float64Array(deviceLen)
  const inside = new Uint8Array(deviceLen)
  const parity = new Uint8Array(deviceLen)
  for (let d = 0; d < deviceLen; d++) {
    const css = (d + 0.5) / dpr - origin
    const img = css / zoom
    coords[d] = img - 0.5
    inside[d] = img >= 0 && img < imageLen ? 1 : 0
    parity[d] = Math.floor(css / CHECKER_CELL) & 1
  }
  return { taps: INTERPOLATORS[method].taps(imageLen, coords), inside, parity }
}

/** Inputs of the expensive resample stage. */
export interface ResampleStages {
  /** View interpolation (lab4); exact copy is used at 100 % to stay pixel-sharp. */
  interpolation?: InterpolatorId
}

/** Inputs of the cheap per-pixel stages applied after resampling. */
export interface PointStages {
  levels?: LevelsLuts | null
  channels?: ChannelMask
}

export type RenderStages = ResampleStages & PointStages

/** Viewport-sized sample of the image before point stages; reusable while only point stages change. */
export interface ViewSample {
  /** Straight-alpha RGBA of sampled image colour (zero outside the image). */
  raster: RasterImage
  /** Per device pixel: 0 outside the image, 1 light checker cell, 2 dark checker cell. */
  cell: Uint8Array
  layout: ImageDocument['versions'][number]['layout']
}

/** Expensive stage: interpolate the visible part of the current version into a viewport-sized buffer. */
export function sampleView(
  doc: ImageDocument,
  view: ViewState,
  vp: Viewport,
  stages: ResampleStages = {},
): ViewSample {
  const { width: W, height: H } = backingSize(vp)
  const version = doc.versions[doc.currentIndex]
  if (!version) throw new Error('Нет текущей версии изображения')
  if (W === 0 || H === 0) {
    return {
      raster: { width: 0, height: 0, data: new Uint8ClampedArray(0) },
      cell: new Uint8Array(0),
      layout: version.layout,
    }
  }
  const img = version.image
  const origin = imageToScreen({ x: 0, y: 0 }, view, vp, img)
  const method: InterpolatorId =
    view.zoom === 1 ? 'nearest' : (stages.interpolation ?? DEFAULT_INTERPOLATOR)
  const xs = axisTable(W, vp.dpr, origin.x, view.zoom, img.width, method)
  const ys = axisTable(H, vp.dpr, origin.y, view.zoom, img.height, method)
  const xt = xs.taps
  const yt = ys.taps

  const out = createRaster(W, H)
  const cell = new Uint8Array(W * H)
  const d = out.data
  const s = img.data
  const sw = img.width
  for (let y = 0, o = 0, c = 0; y < H; y++) {
    const py = ys.parity[y]!
    const rowInside = ys.inside[y] === 1
    for (let x = 0; x < W; x++, o += 4, c++) {
      if (!rowInside || xs.inside[x] !== 1) continue
      cell[c] = (xs.parity[x]! ^ py) === 1 ? 2 : 1
      // interpolate premultiplied colour, then un-premultiply
      let pr = 0
      let pg = 0
      let pb = 0
      let pa = 0
      for (let ky = 0; ky < yt.taps; ky++) {
        const wy = yt.weight[y * yt.taps + ky]!
        if (wy === 0) continue
        const rowOff = yt.index[y * yt.taps + ky]! * sw
        for (let kx = 0; kx < xt.taps; kx++) {
          const w = wy * xt.weight[x * xt.taps + kx]!
          if (w === 0) continue
          const p = (rowOff + xt.index[x * xt.taps + kx]!) * 4
          const aw = s[p + 3]! * w
          pr += s[p]! * aw
          pg += s[p + 1]! * aw
          pb += s[p + 2]! * aw
          pa += aw
        }
      }
      if (pa > 0) {
        d[o] = Math.round(pr / pa)
        d[o + 1] = Math.round(pg / pa)
        d[o + 2] = Math.round(pb / pa)
      }
      d[o + 3] = Math.round(pa)
    }
  }
  return { raster: out, cell, layout: version.layout }
}

/** Cheap stage: levels LUT, channel mask, checkerboard composite, background outside. */
export function composeView(sample: ViewSample, stages: PointStages = {}): RasterImage {
  const { raster, cell, layout } = sample
  const { width: W, height: H } = raster
  if (W === 0 || H === 0) return { width: 0, height: 0, data: new Uint8ClampedArray(0) }
  const out = createRaster(W, H)
  const d = out.data
  const s = raster.data
  const { r: br, g: bg, b: bb } = VIEW_BACKGROUND
  const mask = stages.channels && !isMaskIdentity(stages.channels, layout) ? stages.channels : null
  const px = [0, 0, 0, 0]
  const lut = stages.levels ?? null
  for (let c = 0, o = 0; c < cell.length; c++, o += 4) {
    d[o + 3] = 255
    const kc = cell[c]!
    if (kc === 0) {
      d[o] = br
      d[o + 1] = bg
      d[o + 2] = bb
      continue
    }
    let r = s[o]!
    let g = s[o + 1]!
    let b = s[o + 2]!
    let a = s[o + 3]!
    if (lut) {
      r = lut.r[r]!
      g = lut.g[g]!
      b = lut.b[b]!
      a = lut.a[a]!
    }
    if (mask) {
      maskPixel(r, g, b, a, layout, mask, px)
      r = px[0]!
      g = px[1]!
      b = px[2]!
      a = px[3]!
    }
    if (a === 255) {
      d[o] = r
      d[o + 1] = g
      d[o + 2] = b
      continue
    }
    const k = kc === 2 ? CHECKER_DARK : CHECKER_LIGHT
    if (a === 0) {
      d[o] = k
      d[o + 1] = k
      d[o + 2] = k
      continue
    }
    // odd denominator: no exact .5 ties; Math.round keeps the convention explicit
    const ka = k * (255 - a)
    d[o] = Math.round((r * a + ka) / 255)
    d[o + 1] = Math.round((g * a + ka) / 255)
    d[o + 2] = Math.round((b * a + ka) / 255)
  }
  return out
}

/**
 * Raster of exactly backingSize(vp): visible part of the current version through the full pipeline.
 * Equivalent to composeView(sampleView(...)); the viewport caches the sample between point-stage changes.
 */
export function renderView(
  doc: ImageDocument,
  view: ViewState,
  vp: Viewport,
  stages: RenderStages = {},
): RasterImage {
  return composeView(sampleView(doc, view, vp, stages), stages)
}
