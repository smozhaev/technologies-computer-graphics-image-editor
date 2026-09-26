import { createRaster, type RasterImage } from '../image'

/** Copy with G = B = R (alpha kept). Fixes colour-management drift on greyscale sources. */
export function normalizeGray(image: RasterImage): RasterImage {
  const out = createRaster(image.width, image.height)
  const s = image.data
  const d = out.data
  for (let i = 0; i < s.length; i += 4) {
    const r = s[i]!
    d[i] = r
    d[i + 1] = r
    d[i + 2] = r
    d[i + 3] = s[i + 3]!
  }
  return out
}
