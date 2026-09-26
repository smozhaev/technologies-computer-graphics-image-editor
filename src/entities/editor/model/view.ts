import type { Viewport } from '@/shared/lib/image'
import { editorStore } from './editor'

export function setViewScroll(scrollX: number, scrollY: number): void {
  editorStore.setState((s) =>
    s.view.scrollX === scrollX && s.view.scrollY === scrollY
      ? s
      : { ...s, view: { ...s.view, scrollX, scrollY } },
  )
}

export function setViewportSize(vp: Viewport): void {
  editorStore.setState((s) =>
    s.viewport &&
    s.viewport.cssWidth === vp.cssWidth &&
    s.viewport.cssHeight === vp.cssHeight &&
    s.viewport.dpr === vp.dpr
      ? s
      : { ...s, viewport: vp },
  )
}
