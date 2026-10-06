import type { RasterImage } from './image'
import { resample, type InterpolatorId } from './interpolation'

export type SizeUnit = 'px' | 'percent'

export const MAX_SIDE_PX = 16384
export const MAX_PERCENT = 1000
/** Result size cap: 100 MP ≈ 400 MB per version. */
export const MAX_RESULT_PIXELS = 100_000_000

export interface SizeErrors {
  width?: string
  height?: string
  total?: string
}

/** '2.07 МП' style label. */
export function megapixels(w: number, h: number): string {
  return `${((w * h) / 1e6).toFixed(2)} МП`
}

/** Field value in the chosen unit → integer pixels (≥ 1). */
export function toPixels(value: number, unit: SizeUnit, original: number): number {
  return unit === 'px' ? Math.round(value) : Math.max(1, Math.round((original * value) / 100))
}

export function fromPixels(px: number, unit: SizeUnit, original: number): number {
  return unit === 'px' ? px : Math.round((px / original) * 10000) / 100
}

/** Validates raw field values; returns errors keyed by field (empty object = valid). */
export function validateSize(
  width: number | string,
  height: number | string,
  unit: SizeUnit,
  original: { width: number; height: number },
): SizeErrors {
  const errors: SizeErrors = {}
  const check = (v: number | string, orig: number): string | undefined => {
    if (v === '' || typeof v !== 'number' || !Number.isFinite(v)) return 'Введите число'
    if (unit === 'px') {
      if (!Number.isInteger(v)) return 'Только целое число пикселей'
      if (v < 1 || v > MAX_SIDE_PX) return `От 1 до ${MAX_SIDE_PX} px`
    } else {
      if (v <= 0 || v > MAX_PERCENT) return `От 0 до ${MAX_PERCENT} %`
      if (Math.round((orig * v) / 100) < 1) return 'Слишком мало: меньше 1 px'
      if (Math.round((orig * v) / 100) > MAX_SIDE_PX) return `Больше ${MAX_SIDE_PX} px`
    }
    return undefined
  }
  const we = check(width, original.width)
  const he = check(height, original.height)
  if (we) errors.width = we
  if (he) errors.height = he
  if (!we && !he) {
    const w = toPixels(width as number, unit, original.width)
    const h = toPixels(height as number, unit, original.height)
    if (w * h > MAX_RESULT_PIXELS) {
      errors.total = `Слишком большое изображение: ${megapixels(w, h)}, максимум ${MAX_RESULT_PIXELS / 1e6} МП`
    }
  }
  return errors
}

/** Resize; GB7-range content (levelMax 127) is re-quantised to the 7-bit grid. */
export function resizeImage(
  image: RasterImage,
  width: number,
  height: number,
  method: InterpolatorId,
  levelMax: 127 | 255,
): RasterImage {
  const out = resample(image, width, height, method)
  if (levelMax === 127) {
    const d = out.data
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++)
        d[i + c] = Math.round((Math.round((d[i + c]! * 127) / 255) * 255) / 127)
    }
  }
  return out
}
