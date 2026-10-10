import { useEffect } from 'react'
import { createDocument, currentVersion, pushVersion } from '@/entities/document'
import { editorStore, setDocument, type EditorState } from '@/entities/editor'
import type { ChannelLayout, ImageDocument, RasterImage, SourceInfo } from '@/shared/lib/image'
import { idbDelete, idbGet, idbSet } from '@/shared/lib/storage'

const KEY = 'session'
const SAVE_DELAY_MS = 500

interface SavedImage {
  image: RasterImage
  layout: ChannelLayout
  levelMax: 127 | 255
}

/** What survives a page reload: the file facts, the original and the current image, the view. */
export interface SavedSession {
  version: 1
  source: SourceInfo
  original: SavedImage
  current: SavedImage & { label: string }
  view: { zoom: number; scrollX: number; scrollY: number }
}

function snapshot(doc: ImageDocument, view: EditorState['view']): SavedSession {
  const first = doc.versions[0] ?? currentVersion(doc)
  const cur = currentVersion(doc)
  return {
    version: 1,
    source: doc.source,
    original: { image: first.image, layout: first.layout, levelMax: first.levelMax },
    current: { image: cur.image, layout: cur.layout, levelMax: cur.levelMax, label: cur.label },
    view: { zoom: view.zoom, scrollX: view.scrollX, scrollY: view.scrollY },
  }
}

/** Rebuild a document: original as the first version, the current one on top when it differs. */
export function restoreDocument(s: SavedSession): ImageDocument {
  let doc = createDocument(s.source, s.original)
  if (s.current.image !== s.original.image) {
    doc = pushVersion(doc, s.current.label, s.current)
  }
  return doc
}

export async function saveSession(doc: ImageDocument, view: EditorState['view']): Promise<void> {
  await idbSet(KEY, snapshot(doc, view))
}

export async function loadSession(): Promise<SavedSession | undefined> {
  const s = await idbGet<SavedSession>(KEY)
  return s?.version === 1 ? s : undefined
}

export async function clearSession(): Promise<void> {
  await idbDelete(KEY)
}

/**
 * Restores the last session on mount and keeps it saved: the image is written ~0.5 s after it changes,
 * the view (zoom, scroll) with it; closing the document clears the copy.
 */
export function usePersistSession(): void {
  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let restoring = true
    let lastImage: RasterImage | null = null
    let lastView: EditorState['view'] | null = null

    void loadSession()
      .then((saved) => {
        if (disposed || !saved || editorStore.getState().doc) return
        const doc = restoreDocument(saved)
        editorStore.setState((s) => ({ ...setDocument(s, doc), view: saved.view }))
        lastImage = currentVersion(doc).image
        lastView = editorStore.getState().view
      })
      .catch(() => {
        // a broken or foreign record is ignored; the editor just starts empty
      })
      .finally(() => {
        restoring = false
      })

    const unsubscribe = editorStore.subscribe(() => {
      if (restoring) return
      const { doc, view } = editorStore.getState()
      if (!doc) {
        if (lastImage) {
          lastImage = null
          if (timer) clearTimeout(timer)
          void clearSession()
        }
        return
      }
      const image = currentVersion(doc).image
      if (image === lastImage && view === lastView) return
      lastImage = image
      lastView = view
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const s = editorStore.getState()
        if (s.doc) void saveSession(s.doc, s.view).catch(() => {})
      }, SAVE_DELAY_MS)
    })

    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [])
}
