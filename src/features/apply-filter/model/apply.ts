import type { RasterImage } from '@/shared/lib/image'
import { currentVersion, deriveLayout, pushVersion } from '@/entities/document'
import { editorStore } from '@/entities/editor'

/** Push a filtered raster as a new version «Фильтр». */
export function applyFilterResult(image: RasterImage): void {
  const doc = editorStore.getState().doc
  if (!doc) return
  const v = currentVersion(doc)
  const next = pushVersion(doc, 'Фильтр', {
    image,
    layout: deriveLayout(image, v.layout),
    levelMax: v.levelMax,
  })
  editorStore.setState((s) => ({ ...s, doc: next, filterPreview: null, dialog: null }))
}
