import { pushVersion, undo } from '@/entities/document'
import { editorStore } from '@/entities/editor'

/** Step back one version (Ctrl+Z). */
export function undoVersion(): void {
  editorStore.setState((s) => {
    if (!s.doc || s.doc.currentIndex === 0) return s
    return { ...s, doc: undo(s.doc), picked: null }
  })
}

/** Back to the image as it was opened; an ordinary undoable version «Исходное». */
export function revertToOriginal(): void {
  editorStore.setState((s) => {
    const first = s.doc?.versions[0]
    if (!s.doc || !first || s.doc.versions[s.doc.currentIndex]?.image === first.image) return s
    const doc = pushVersion(s.doc, 'Исходное', {
      image: first.image,
      layout: first.layout,
      levelMax: first.levelMax,
    })
    return { ...s, doc, picked: null }
  })
}
