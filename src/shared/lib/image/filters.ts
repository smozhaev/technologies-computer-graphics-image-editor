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

/** True when every pixel has R = G = B (stops at the first colour pixel). */
function isGrey(data: Uint8ClampedArray): boolean {
  for (let p = 0; p < data.length; p += 4) {
    const r = data[p]
    if (data[p + 1] !== r || data[p + 2] !== r) return false
  }
  return true
}

/** Copy source row `sy` into a padded row buffer (w + 2 pixels) using the padding strategy. */
function fillPaddedRow(
  row: Uint8Array,
  src: Uint8ClampedArray,
  w: number,
  h: number,
  sy: number,
  mode: PaddingMode,
): void {
  if (mode !== 'replicate' && (sy < 0 || sy >= h)) {
    const fill = mode === 'white' ? 255 : 0
    for (let o = 0; o < row.length; o += 4) {
      row[o] = fill
      row[o + 1] = fill
      row[o + 2] = fill
      // padding is opaque, so convolving alpha does not fade the edges
      row[o + 3] = 255
    }
    return
  }
  const cy = sy < 0 ? 0 : sy >= h ? h - 1 : sy
  const start = cy * w * 4
  row.set(src.subarray(start, start + w * 4), 4)
  const last = row.length - 4
  if (mode === 'replicate') {
    for (let c = 0; c < 4; c++) {
      row[c] = row[4 + c]!
      row[last + c] = row[last - 4 + c]!
    }
  } else {
    const fill = mode === 'white' ? 255 : 0
    row[0] = row[1] = row[2] = row[last] = row[last + 1] = row[last + 2] = fill
    row[3] = row[last + 3] = 255
  }
}

/**
 * 3×3 convolution of selected channels; output size equals input; others copied unchanged.
 * Works on a rolling window of three padded rows, so memory stays O(width).
 */
export function convolve3x3(
  image: RasterImage,
  kernel: Kernel,
  channels: FilterChannels,
  mode: PaddingMode,
  levelMax: 127 | 255 = 255,
): RasterImage {
  const { width: w, height: h, data: src } = image
  const out = createRaster(w, h)
  out.data.set(src)
  // plain byte views: values are clamped by hand, and Uint8Array stores are cheaper than clamped ones
  const d = new Uint8Array(out.data.buffer, out.data.byteOffset, out.data.length)
  const sel = [channels.r, channels.g, channels.b, channels.a]
  if (!sel.some(Boolean) || w === 0 || h === 0) return out

  const [k0, k1, k2, k3, k4, k5, k6, k7, k8] = kernel.weights.map((v) => v ?? 0) as number[]
  const div = kernel.divisor === 0 ? 1 : kernel.divisor
  const bias = kernel.offset + 0.5
  // GB7 colour stays on the 7-bit grid; alpha is never quantised
  const quant = new Uint8Array(256)
  for (let v = 0; v < 256; v++) {
    quant[v] = levelMax === 127 ? Math.round((Math.round((v * 127) / 255) * 255) / 127) : v
  }

  // grey pixels (R = G = B) with all colour channels selected: convolve R once, copy to G and B
  const grey = sel[0] && sel[1] && sel[2] && isGrey(src)

  const rowLen = (w + 2) * 4
  let top = new Uint8Array(rowLen)
  let mid = new Uint8Array(rowLen)
  let bot = new Uint8Array(rowLen)
  fillPaddedRow(top, src, w, h, -1, mode)
  fillPaddedRow(mid, src, w, h, 0, mode)
  for (let y = 0; y < h; y++) {
    fillPaddedRow(bot, src, w, h, y + 1, mode)
    const base = y * w * 4
    for (let c = 0; c < 4; c++) {
      if (!sel[c] || (grey && (c === 1 || c === 2))) continue
      const q = c < 3
      for (let x = 0, p = c; x < w; x++, p += 4) {
        const sum =
          k0! * top[p]! +
          k1! * top[p + 4]! +
          k2! * top[p + 8]! +
          k3! * mid[p]! +
          k4! * mid[p + 4]! +
          k5! * mid[p + 8]! +
          k6! * bot[p]! +
          k7! * bot[p + 4]! +
          k8! * bot[p + 8]!
        // round half up, then clamp; truncation equals floor once t is non-negative
        const t = sum / div + bias
        const v = t < 0 ? 0 : t >= 255 ? 255 : t | 0
        const o = base + x * 4 + c
        if (grey && c === 0) {
          d[o] = d[o + 1] = d[o + 2] = quant[v]!
        } else {
          d[o] = q ? quant[v]! : v
        }
      }
    }
    const t = top
    top = mid
    mid = bot
    bot = t
  }
  return out
}
