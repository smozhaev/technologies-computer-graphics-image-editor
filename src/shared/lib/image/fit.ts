import type { ViewState, Viewport } from './geometry'

export const ZOOM_MIN = 0.12
export const ZOOM_MAX = 3
export const ZOOM_PRESETS = [0.12, 0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3] as const
export const FIT_MARGIN = 50

export function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

/** Largest zoom that fits the whole image with ≥ FIT_MARGIN px on every side, clamped to 12–300 %. */
export function fitZoom(img: { width: number; height: number }, vp: Viewport): number {
  const w = Math.max(1, vp.cssWidth - 2 * FIT_MARGIN)
  const h = Math.max(1, vp.cssHeight - 2 * FIT_MARGIN)
  return clampZoom(Math.min(w / img.width, h / img.height))
}

function axisScroll(
  len: number,
  oldZoom: number,
  newZoom: number,
  view: number,
  scroll: number,
): number {
  const oldZ = len * oldZoom
  const newZ = len * newZoom
  if (newZ <= view) return 0
  // image coordinate at the viewport centre stays at the centre
  const centre = oldZ <= view ? len / 2 : (scroll + view / 2) / oldZoom
  return Math.min(newZ - view, Math.max(0, centre * newZoom - view / 2))
}

/** New view state for a zoom change that keeps the viewport centre over the same image point. */
export function zoomKeepingCentre(
  view: ViewState,
  zoom: number,
  vp: Viewport,
  img: { width: number; height: number },
): ViewState {
  const z = clampZoom(zoom)
  return {
    zoom: z,
    scrollX: Math.round(axisScroll(img.width, view.zoom, z, vp.cssWidth, view.scrollX)),
    scrollY: Math.round(axisScroll(img.height, view.zoom, z, vp.cssHeight, view.scrollY)),
  }
}

function axisAnchored(
  len: number,
  oldZoom: number,
  newZoom: number,
  view: number,
  scroll: number,
  anchor: number,
): number {
  const newZ = len * newZoom
  if (newZ <= view) return 0
  const oldZ = len * oldZoom
  const offset = oldZ <= view ? Math.floor((view - oldZ) / 2) : -scroll
  // image coordinate under the anchor stays under the anchor
  const imagePoint = Math.min(len, Math.max(0, (anchor - offset) / oldZoom))
  return Math.min(newZ - view, Math.max(0, imagePoint * newZoom - anchor))
}

/** Zoom change that keeps the image point under `anchor` (viewport CSS px) in place. */
export function zoomAtPoint(
  view: ViewState,
  zoom: number,
  vp: Viewport,
  img: { width: number; height: number },
  anchor: { x: number; y: number },
): ViewState {
  const z = clampZoom(zoom)
  return {
    zoom: z,
    scrollX: Math.round(axisAnchored(img.width, view.zoom, z, vp.cssWidth, view.scrollX, anchor.x)),
    scrollY: Math.round(
      axisAnchored(img.height, view.zoom, z, vp.cssHeight, view.scrollY, anchor.y),
    ),
  }
}
