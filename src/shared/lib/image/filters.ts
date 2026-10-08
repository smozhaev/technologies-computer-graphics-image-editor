import { createRaster, type RasterImage } from './image'

export type PaddingMode = 'black' | 'white' | 'replicate'

export interface Kernel {
  /** 9 weights row-major. */
  weights: readonly number[]
  divisor: number
  offset: number
}

export interface FilterChannels {
  r: boolean
  g: boolean
  b: boolean
  a: boolean
}

export type PresetId = 'identity' | 'sharpen' | 'gaussian' | 'box' | 'prewitt-x' | 'prewitt-y'

export const PRESETS: Readonly<Record<PresetId, { name: string; kernel: Kernel }>> = {
  identity: {
    name: 'Тождественное',
    kernel: { weights: [0, 0, 0, 0, 1, 0, 0, 0, 0], divisor: 1, offset: 0 },
  },
  sharpen: {
    name: 'Повышение резкости',
    kernel: { weights: [0, -1, 0, -1, 5, -1, 0, -1, 0], divisor: 1, offset: 0 },
  },
  gaussian: {
    name: 'Фильтр Гаусса 3×3',
    kernel: { weights: [1, 2, 1, 2, 4, 2, 1, 2, 1], divisor: 16, offset: 0 },
  },
  box: {
    name: 'Прямоугольное размытие',
    kernel: { weights: [1, 1, 1, 1, 1, 1, 1, 1, 1], divisor: 9, offset: 0 },
  },
  'prewitt-x': {
    name: 'Прюитт: вертикальные границы',
    kernel: { weights: [-1, 0, 1, -1, 0, 1, -1, 0, 1], divisor: 1, offset: 128 },
  },
  'prewitt-y': {
    name: 'Прюитт: горизонтальные границы',
    kernel: { weights: [-1, -1, -1, 0, 0, 0, 1, 1, 1], divisor: 1, offset: 128 },
  },
}

/** Raster grown by `r` pixels on every side using the padding strategy (all four channels). */
export function pad(image: RasterImage, r: number, mode: PaddingMode): RasterImage {
  const { width: w, height: h, data: s } = image
  const W = w + 2 * r
  const H = h + 2 * r
  const out = createRaster(W, H)
  const d = out.data
  const fill = mode === 'white' ? 255 : 0
  for (let y = 0; y < H; y++) {
    const sy = y - r
    for (let x = 0; x < W; x++) {
      const sx = x - r
      const o = (y * W + x) * 4
      const inside = sx >= 0 && sx < w && sy >= 0 && sy < h
      if (inside || mode === 'replicate') {
        const cx = sx < 0 ? 0 : sx >= w ? w - 1 : sx
        const cy = sy < 0 ? 0 : sy >= h ? h - 1 : sy
        const p = (cy * w + cx) * 4
        d[o] = s[p]!
        d[o + 1] = s[p + 1]!
        d[o + 2] = s[p + 2]!
        d[o + 3] = s[p + 3]!
      } else {
        d[o] = fill
        d[o + 1] = fill
        d[o + 2] = fill
        // padding is opaque, so convolving alpha does not fade the edges
        d[o + 3] = 255
      }
    }
  }
  return out
}

/** 3×3 convolution of selected channels; output size equals input; others copied unchanged. */
export function convolve3x3(
  image: RasterImage,
  kernel: Kernel,
  channels: FilterChannels,
  mode: PaddingMode,
  levelMax: 127 | 255 = 255,
): RasterImage {
  const { width: w, height: h } = image
  const padded = pad(image, 1, mode)
  const P = padded.data
  const PW = w + 2
  const out = createRaster(w, h)
  const d = out.data
  const k = kernel.weights
  const div = kernel.divisor === 0 ? 1 : kernel.divisor
  const sel = [channels.r, channels.g, channels.b, channels.a]
  const src = image.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      for (let c = 0; c < 4; c++) {
        if (!sel[c]) {
          d[o + c] = src[o + c]!
          continue
        }
        let sum = 0
        for (let ky = 0; ky < 3; ky++) {
          const row = ((y + ky) * PW + x) * 4 + c
          sum += k[ky * 3]! * P[row]! + k[ky * 3 + 1]! * P[row + 4]! + k[ky * 3 + 2]! * P[row + 8]!
        }
        let v = Math.round(sum / div + kernel.offset)
        v = v < 0 ? 0 : v > 255 ? 255 : v
        d[o + c] =
          c < 3 && levelMax === 127 ? Math.round((Math.round((v * 127) / 255) * 255) / 127) : v
      }
    }
  }
  return out
}
