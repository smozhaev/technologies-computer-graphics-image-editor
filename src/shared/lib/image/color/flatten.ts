import { createRaster, type RasterImage } from '../image'

/** Straight-alpha "over" onto an opaque colour (components 0..255); output alpha 255. */
export function flattenOnto(
  image: RasterImage,
  bg: { r: number; g: number; b: number },
): RasterImage {
  const out = createRaster(image.width, image.height)
  const s = image.data
  const d = out.data
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3]!
    const ia = 255 - a
    d[i] = Math.round((s[i]! * a + bg.r * ia) / 255)
    d[i + 1] = Math.round((s[i + 1]! * a + bg.g * ia) / 255)
    d[i + 2] = Math.round((s[i + 2]! * a + bg.b * ia) / 255)
    d[i + 3] = 255
  }
  return out
}
