import type { InterpolatorId } from '@/shared/lib/image'
import { getRunner } from '@/shared/lib/worker'
import { currentVersion, pushVersion } from '@/entities/document'
import { editorStore } from '@/entities/editor'

/**
 * Resize the current version at full resolution in the Web Worker; pushes «Размер».
 * Resolves false if the document changed meanwhile; rejects with a Russian message on failure.
 */
export async function resizeDocument(
  width: number,
  height: number,
  method: InterpolatorId,
): Promise<boolean> {
  const doc = editorStore.getState().doc
  if (!doc) return false
  const v = currentVersion(doc)
  const image = await getRunner().resize(v.image, { width, height, method, levelMax: v.levelMax })
  const now = editorStore.getState().doc
  if (!image || !now || currentVersion(now) !== v) return false
  const next = pushVersion(now, 'Размер', { image, layout: v.layout, levelMax: v.levelMax })
  editorStore.setState((s) => ({
    ...s,
    doc: next,
    dialog: null,
    picked: null,
    view: { ...s.view, scrollX: 0, scrollY: 0 },
  }))
  return true
}
