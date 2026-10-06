import { fitZoom, zoomAtPoint, zoomKeepingCentre } from '@/shared/lib/image'
import { editorStore } from '@/entities/editor'

/** Change zoom keeping the viewport centre fixed. */
export function setZoom(zoom: number): void {
  editorStore.setState((s) => {
    const img = s.doc ? s.doc.versions[s.doc.currentIndex]?.image : undefined
    if (!img || !s.viewport) return s
    const view = zoomKeepingCentre(s.view, zoom, s.viewport, img)
    return view.zoom === s.view.zoom &&
      view.scrollX === s.view.scrollX &&
      view.scrollY === s.view.scrollY
      ? s
      : { ...s, view }
  })
}

/** Fit the current image into the viewport. */
export function fitToView(): void {
  editorStore.setState((s) => {
    const img = s.doc ? s.doc.versions[s.doc.currentIndex]?.image : undefined
    if (!img || !s.viewport) return s
    return { ...s, view: { zoom: fitZoom(img, s.viewport), scrollX: 0, scrollY: 0 } }
  })
}

/** Ctrl/⌘ + wheel or trackpad pinch: zoom by `factor` around a viewport point. */
export function zoomBy(factor: number, anchor: { x: number; y: number }): void {
  editorStore.setState((s) => {
    const img = s.doc ? s.doc.versions[s.doc.currentIndex]?.image : undefined
    if (!img || !s.viewport) return s
    const view = zoomAtPoint(s.view, s.view.zoom * factor, s.viewport, img, anchor)
    return view.zoom === s.view.zoom &&
      view.scrollX === s.view.scrollX &&
      view.scrollY === s.view.scrollY
      ? s
      : { ...s, view }
  })
}
