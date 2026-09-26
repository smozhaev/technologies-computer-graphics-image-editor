import {
  hasTransparency,
  isGrayLayout,
  type ChannelLayout,
  type ImageDocument,
  type RasterImage,
  type SourceInfo,
} from '@/shared/lib/image'
import { detectFormat } from '@/shared/lib/image'
import { decodeGb7, Gb7Error } from '@/shared/lib/image'
import { fallbackHeaderInfo, HeaderError, type HeaderInfo } from '@/shared/lib/image'
import { readJpegHeader } from '@/shared/lib/image'
import { readPngHeader } from '@/shared/lib/image'
import { createDocument } from '@/entities/document'
import { decodeWithBrowser } from '@/shared/lib/io'

export class OpenFileError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'OpenFileError'
  }
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i) : ''
}

/** File → ImageDocument. Reads bytes once, detects by signature, decodes, builds SourceInfo. */
export async function openImageFile(file: File): Promise<ImageDocument> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const format = detectFormat(bytes)

    if (format === 'unknown') {
      const ext = extensionOf(file.name)
      throw new OpenFileError(
        `Неподдерживаемый формат файла${ext ? ` (расширение ${ext})` : ''}. Поддерживаются PNG, JPG, GB7`,
      )
    }

    if (format === 'gb7') {
      let decoded
      try {
        decoded = decodeGb7(bytes)
      } catch (e) {
        if (e instanceof Gb7Error) throw new OpenFileError(e.message, { cause: e })
        throw e
      }
      const { image, hasMask } = decoded
      const source: SourceInfo = {
        format,
        fileName: file.name,
        bitDepth: hasMask ? 8 : 7,
        depthLabel: hasMask ? '8 бит (7 + маска)' : '7 бит',
        sourceWidth: image.width,
        sourceHeight: image.height,
        gb7HasMask: hasMask,
      }
      return createDocument(source, {
        image,
        layout: hasMask ? 'gray-alpha' : 'gray',
        levelMax: 127,
      })
    }

    let header: HeaderInfo | null = null
    let headerError: unknown = null
    try {
      header = format === 'png' ? readPngHeader(bytes) : readJpegHeader(bytes)
    } catch (e) {
      if (!(e instanceof HeaderError)) throw e
      headerError = e
    }

    let image: RasterImage
    try {
      image = await decodeWithBrowser(bytes, format === 'png' ? 'image/png' : 'image/jpeg', {
        gray: header ? isGrayLayout(header.layout) : false,
      })
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      throw new OpenFileError(`Не удалось декодировать изображение: ${reason}`, { cause: e })
    }

    if (!header) {
      console.warn(
        'Не удалось прочитать заголовок, глубина цвета определена по пикселям',
        headerError,
      )
      header = fallbackHeaderInfo(image.width, image.height, hasTransparency(image))
    }
    const layout: ChannelLayout = header.layout
    const source: SourceInfo = {
      format,
      fileName: file.name,
      bitDepth: header.bitDepth,
      depthLabel: header.depthLabel,
      sourceWidth: image.width,
      sourceHeight: image.height,
      gb7HasMask: false,
    }
    return createDocument(source, { image, layout, levelMax: 255 })
  } catch (e) {
    if (e instanceof OpenFileError) throw e
    if (e instanceof RangeError)
      throw new OpenFileError('Недостаточно памяти для изображения', { cause: e })
    throw new OpenFileError(e instanceof Error ? e.message : 'Не удалось открыть файл', {
      cause: e,
    })
  }
}
