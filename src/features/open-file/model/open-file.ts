import { currentVersion } from '@/entities/document'
import { editorStore, setDocument } from '@/entities/editor'
import { OpenFileError, openImageFile } from '../lib/open-image-file'

export type OpenResult =
  | { status: 'opened'; warning?: string }
  | { status: 'error'; message: string }
  | { status: 'stale' }

const LARGE_PIXELS = 50_000_000
let latestOpenToken = 0

export async function openFile(file: File): Promise<OpenResult> {
  const token = ++latestOpenToken
  editorStore.setState((s) => ({ ...s, busy: true }))
  try {
    const doc = await openImageFile(file)
    if (token !== latestOpenToken) return { status: 'stale' }
    editorStore.setState((s) => ({ ...setDocument(s, doc), busy: false }))
    const { width, height } = currentVersion(doc).image
    const pixels = width * height
    if (pixels > LARGE_PIXELS) {
      const mp = Math.round(pixels / 1e6)
      return {
        status: 'opened',
        warning: `Очень большое изображение (${mp} МП): работа может быть медленной`,
      }
    }
    return { status: 'opened' }
  } catch (e) {
    if (token !== latestOpenToken) return { status: 'stale' }
    editorStore.setState((s) => ({ ...s, busy: false }))
    const message = e instanceof OpenFileError ? e.message : 'Не удалось открыть файл'
    return { status: 'error', message }
  }
}
