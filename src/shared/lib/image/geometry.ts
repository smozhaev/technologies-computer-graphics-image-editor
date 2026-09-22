/** Scroll is in CSS px of the zoomed image. */
export interface ViewState {
  zoom: number
  scrollX: number
  scrollY: number
}

export interface Viewport {
  cssWidth: number
  cssHeight: number
  dpr: number
}

interface Size {
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

function axisOffset(imageLen: number, zoom: number, viewLen: number, scroll: number): number {
  const zoomed = imageLen * zoom
  return zoomed <= viewLen ? Math.floor((viewLen - zoomed) / 2) : -scroll
}

/** Top-left of the image in viewport CSS px: centred per axis when it fits, else -scroll. */
export function imageOffset(view: ViewState, vp: Viewport, img: Size): Point {
  return {
    x: axisOffset(img.width, view.zoom, vp.cssWidth, view.scrollX),
    y: axisOffset(img.height, view.zoom, vp.cssHeight, view.scrollY),
  }
}

/** CSS point inside the viewport → integer image pixel; null if outside the image. */
export function screenToImage(p: Point, view: ViewState, vp: Viewport, img: Size): Point | null {
  const off = imageOffset(view, vp, img)
  const x = Math.floor((p.x - off.x) / view.zoom)
  const y = Math.floor((p.y - off.y) / view.zoom)
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null
  return { x, y }
}

/** Image point (may be fractional) → viewport CSS px. */
export function imageToScreen(p: Point, view: ViewState, vp: Viewport, img: Size): Point {
  const off = imageOffset(view, vp, img)
  return { x: off.x + p.x * view.zoom, y: off.y + p.y * view.zoom }
}
