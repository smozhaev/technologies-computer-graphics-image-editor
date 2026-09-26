import { flattenOnto } from '@/shared/lib/image'
import { sanitizeFileName, type SaveExtension } from '@/shared/lib/image'
import { encodeGb7, type Gb7MaskMode } from '@/shared/lib/image'
import type { SourceInfo } from '@/shared/lib/image'
import { downloadBlob } from '@/shared/lib/io'
import { encodeWithBrowser } from '@/shared/lib/io'
import { currentVersion } from '@/entities/document'
import { editorStore, setDialog } from '@/entities/editor'

export interface SaveOptions {
  format: 'png' | 'jpeg' | 'gb7'
  name: string
  /** JPEG 1–100, default 92 */
  quality?: number
  background?: { r: number; g: number; b: number }
  mask?: Gb7MaskMode
}

export class SaveError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SaveError'
  }
}

export function defaultGb7MaskMode(source: SourceInfo): Gb7MaskMode {
  return source.gb7HasMask ? 'always' : 'auto'
}

const EXT: Record<SaveOptions['format'], SaveExtension> = { png: 'png', jpeg: 'jpg', gb7: 'gb7' }
const WHITE = { r: 255, g: 255, b: 255 }

/** Encodes the CURRENT version and triggers a download. Rejects with SaveError. */
export async function saveAs(options: SaveOptions): Promise<void> {
  const doc = editorStore.getState().doc
  if (!doc) throw new SaveError('Нет открытого изображения')
  const { image } = currentVersion(doc)

  editorStore.setState((s) => ({ ...s, busy: true }))
  try {
    const fileName = sanitizeFileName(options.name, EXT[options.format])
    let blob: Blob
    if (options.format === 'png') {
      blob = await encodeWithBrowser(image, { format: 'png' })
    } else if (options.format === 'jpeg') {
      const flat = flattenOnto(image, options.background ?? WHITE)
      blob = await encodeWithBrowser(flat, { format: 'jpeg', quality: options.quality ?? 92 })
    } else {
      const bytes = encodeGb7(image, { mask: options.mask ?? defaultGb7MaskMode(doc.source) })
      blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' })
    }
    downloadBlob(blob, fileName)
    editorStore.setState((s) => setDialog({ ...s, busy: false }, null))
  } catch (e) {
    editorStore.setState((s) => ({ ...s, busy: false }))
    throw new SaveError(e instanceof Error ? e.message : 'Не удалось сохранить изображение', {
      cause: e,
    })
  }
}
