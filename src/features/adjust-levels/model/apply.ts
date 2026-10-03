import { applyLevels, type LevelsLuts } from '@/shared/lib/image'
import { currentVersion, deriveLayout, pushVersion } from '@/entities/document'
import { editorStore } from '@/entities/editor'

/** Apply levels to the current version at full resolution and push a new version. */
export function applyLevelsToDocument(luts: LevelsLuts | null): void {
  const doc = editorStore.getState().doc
  if (!doc) return
  if (!luts) {
    editorStore.setState((s) => ({ ...s, levelsPreview: null, dialog: null }))
    return
  }
  const v = currentVersion(doc)
  const image = applyLevels(v.image, luts)
  const next = pushVersion(doc, 'Уровни', {
    image,
    layout: deriveLayout(image, v.layout),
    levelMax: v.levelMax,
  })
  editorStore.setState((s) => ({ ...s, doc: next, levelsPreview: null, dialog: null }))
}
