import { screenToImage, type Viewport } from '@/shared/lib/image'
import { samplePixel } from '@/shared/lib/image'
import { currentVersion } from '@/entities/document'
import { editorStore } from '@/entities/editor'

/** Eyedropper: read the current version at a viewport CSS point. */
export function pickAt(cssX: number, cssY: number, vp: Viewport): void {
  const { doc, view } = editorStore.getState()
  if (!doc) return
  const { image } = currentVersion(doc)
  const p = screenToImage({ x: cssX, y: cssY }, view, vp, image)
  const sample = p ? samplePixel(image, p.x, p.y) : null
  if (sample) editorStore.setState((s) => ({ ...s, picked: sample }))
}
