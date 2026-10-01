import { srgbToLab, type Lab } from './color/lab'
import type { RasterImage } from './image'

export interface Sample {
  x: number
  y: number
  r: number
  g: number
  b: number
  a: number
  lab: Lab
}

/** Pixel at integer image coords with its CIELAB; null outside. */
export function samplePixel(image: RasterImage, x: number, y: number): Sample | null {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= image.width ||
    y >= image.height
  ) {
    return null
  }
  const p = (y * image.width + x) * 4
  const d = image.data
  const r = d[p]!
  const g = d[p + 1]!
  const b = d[p + 2]!
  return { x, y, r, g, b, a: d[p + 3]!, lab: srgbToLab(r, g, b) }
}
