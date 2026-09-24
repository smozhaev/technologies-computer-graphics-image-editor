import type { RasterImage } from '@/shared/lib/image'
import { BrowserImageError } from './errors'

export interface EncodeOptions {
  format: 'png' | 'jpeg'
  /** JPEG quality 1–100, default 92. Ignored for PNG. */
  quality?: number
}

const MIME = { png: 'image/png', jpeg: 'image/jpeg' } as const

/** RasterImage → Blob via canvas.toBlob. Caller flattens alpha before JPEG. */
export async function encodeWithBrowser(image: RasterImage, opts: EncodeOptions): Promise<Blob> {
  const mime = MIME[opts.format]
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new BrowserImageError('Не удалось получить контекст canvas')
  ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0)

  const blob = await new Promise<Blob | null>((resolve) => {
    if (opts.format === 'jpeg') canvas.toBlob(resolve, mime, (opts.quality ?? 92) / 100)
    else canvas.toBlob(resolve, mime)
  })
  if (!blob) throw new BrowserImageError('Браузер не смог закодировать изображение')
  if (blob.type !== mime) {
    throw new BrowserImageError(
      `Браузер не поддерживает сохранение в формате ${opts.format === 'jpeg' ? 'JPEG' : 'PNG'}`,
    )
  }
  return blob
}
