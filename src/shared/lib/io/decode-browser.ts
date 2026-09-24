import { normalizeGray } from '@/shared/lib/image'
import { assertRaster, type RasterImage } from '@/shared/lib/image'
import { BrowserImageError } from './errors'

/** PNG/JPEG → RasterImage via createImageBitmap + one getImageData. opts.gray → G = B = R. */
export async function decodeWithBrowser(
  bytes: Uint8Array,
  mime: string,
  opts: { gray?: boolean } = {},
): Promise<RasterImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }), {
      imageOrientation: 'from-image',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
  } catch (e) {
    throw new BrowserImageError('Браузер не смог декодировать изображение', { cause: e })
  }

  try {
    const { width, height } = bitmap
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new BrowserImageError('Не удалось получить контекст canvas')
    ctx.drawImage(bitmap, 0, 0)
    const pixels = ctx.getImageData(0, 0, width, height)
    const raster: RasterImage = { width, height, data: new Uint8ClampedArray(pixels.data) }
    assertRaster(raster)
    return opts.gray ? normalizeGray(raster) : raster
  } catch (e) {
    if (e instanceof BrowserImageError) throw e
    throw new BrowserImageError('Браузер не смог декодировать изображение', { cause: e })
  } finally {
    bitmap.close()
  }
}
