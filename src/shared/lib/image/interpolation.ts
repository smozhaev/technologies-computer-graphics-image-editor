import { createRaster, type RasterImage } from './image'

/** Separable sampling table: for output i, taps source indices index[i*taps+k] with weight[i*taps+k]. */
export interface TapTable {
  taps: number
  index: Int32Array
  weight: Float32Array
}

export type InterpolatorId = 'nearest' | 'bilinear'

export interface Interpolator {
  id: InterpolatorId
  name: string
  description: string
  /** Build taps for source positions `coords` (pixel-centre space, may be fractional) in a source of srcLen. */
  taps(srcLen: number, coords: Float64Array): TapTable
}

const clampIndex = (i: number, len: number) => (i < 0 ? 0 : i >= len ? len - 1 : i)

const nearest: Interpolator = {
  id: 'nearest',
  name: 'Ближайший сосед',
  description:
    'Берёт ближайший исходный пиксель. Самый быстрый, сохраняет точные значения и резкие границы (пиксель-арт, увеличение для разглядывания), но даёт «лесенку» и мерцание при уменьшении.',
  taps(srcLen, coords) {
    const n = coords.length
    const index = new Int32Array(n)
    const weight = new Float32Array(n).fill(1)
    for (let i = 0; i < n; i++) index[i] = clampIndex(Math.floor(coords[i]! + 0.5), srcLen)
    return { taps: 1, index, weight }
  },
}

const bilinear: Interpolator = {
  id: 'bilinear',
  name: 'Билинейная',
  description:
    'Взвешенное среднее четырёх соседних пикселей. Плавные переходы без «лесенки», хорошо для фотографий; немного размывает мелкие детали.',
  taps(srcLen, coords) {
    const n = coords.length
    const index = new Int32Array(n * 2)
    const weight = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      const c = coords[i]!
      const f = Math.floor(c)
      const t = c - f
      index[i * 2] = clampIndex(f, srcLen)
      index[i * 2 + 1] = clampIndex(f + 1, srcLen)
      weight[i * 2] = 1 - t
      weight[i * 2 + 1] = t
    }
    return { taps: 2, index, weight }
  },
}

export const INTERPOLATORS: Readonly<Record<InterpolatorId, Interpolator>> = { nearest, bilinear }
export const DEFAULT_INTERPOLATOR: InterpolatorId = 'bilinear'

/** Source pixel-centre coordinate for each destination index: (d + 0.5)/scale − 0.5 + offset. */
export function centreCoords(dstLen: number, scale: number, offset = 0): Float64Array {
  const out = new Float64Array(dstLen)
  for (let d = 0; d < dstLen; d++) out[d] = (d + 0.5) / scale - 0.5 + offset
  return out
}

/**
 * Generic separable resampler over premultiplied colour. xs/ys select source samples per output column/row;
 * `valid` rows/cols (optional) mark outputs inside the image; others are left as zero.
 */
export function applyTaps(
  src: RasterImage,
  xs: TapTable,
  ys: TapTable,
  dstW: number,
  dstH: number,
): RasterImage {
  const out = createRaster(dstW, dstH)
  const s = src.data
  const d = out.data
  const sw = src.width
  for (let y = 0, o = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++, o += 4) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let ky = 0; ky < ys.taps; ky++) {
        const wy = ys.weight[y * ys.taps + ky]!
        if (wy === 0) continue
        const row = ys.index[y * ys.taps + ky]! * sw
        for (let kx = 0; kx < xs.taps; kx++) {
          const w = wy * xs.weight[x * xs.taps + kx]!
          if (w === 0) continue
          const p = (row + xs.index[x * xs.taps + kx]!) * 4
          const pa = s[p + 3]! * w
          r += s[p]! * pa
          g += s[p + 1]! * pa
          b += s[p + 2]! * pa
          a += pa
        }
      }
      if (a > 0) {
        d[o] = Math.round(r / a)
        d[o + 1] = Math.round(g / a)
        d[o + 2] = Math.round(b / a)
      }
      d[o + 3] = Math.round(a)
    }
  }
  return out
}

/** Whole-image resize with the chosen method. */
export function resample(
  src: RasterImage,
  dstW: number,
  dstH: number,
  id: InterpolatorId = DEFAULT_INTERPOLATOR,
): RasterImage {
  const ip = INTERPOLATORS[id]
  const xs = ip.taps(src.width, centreCoords(dstW, dstW / src.width))
  const ys = ip.taps(src.height, centreCoords(dstH, dstH / src.height))
  return applyTaps(src, xs, ys, dstW, dstH)
}
