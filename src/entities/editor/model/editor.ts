import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  ALL_CHANNELS_ON,
  channelsForLayout,
  type ChannelId,
  type ChannelLayout,
  type ChannelMask,
} from '@/shared/lib/image'
import type { ViewState, Viewport } from '@/shared/lib/image'
import { DEFAULT_INTERPOLATOR, type InterpolatorId } from '@/shared/lib/image'
import { fitZoom } from '@/shared/lib/image'
import type { LevelsLuts } from '@/shared/lib/image'
import type { Sample } from '@/shared/lib/image'
import type { ImageDocument, RasterImage } from '@/shared/lib/image'

export type DialogKind = null | 'save' | 'levels' | 'resize' | 'filter'

/** Eyedropper reading of the current version. */
export type PixelSample = Sample

export interface EditorState {
  doc: ImageDocument | null
  view: ViewState
  /** Measured canvas area; null until the viewport mounts. */
  viewport: Viewport | null
  /** Method used to draw the image at zoom ≠ 100 %. */
  interpolation: InterpolatorId
  channels: ChannelMask
  picked: PixelSample | null
  /** Live preview tables while the Levels dialog is open. */
  levelsPreview: LevelsLuts | null
  /** Full-resolution filtered raster while the filter dialog previews. */
  filterPreview: RasterImage | null
  activeTool: 'pointer' | 'eyedropper'
  dialog: DialogKind
  busy: boolean
}

export const initialView: ViewState = { zoom: 1, scrollX: 0, scrollY: 0 }

export const initialEditorState: EditorState = {
  doc: null,
  view: initialView,
  viewport: null,
  interpolation: DEFAULT_INTERPOLATOR,
  channels: ALL_CHANNELS_ON,
  picked: null,
  levelsPreview: null,
  filterPreview: null,
  activeTool: 'pointer',
  dialog: null,
  busy: false,
}

/**
 * Editor store (Zustand). Transitions are pure functions `(state) => state` applied with
 * `editorStore.setState(fn)`; returning the same reference skips notification.
 */
export const useEditorStore = create<EditorState>()(
  devtools(() => initialEditorState, { name: 'editor', enabled: import.meta.env.DEV }),
)

/** Imperative access for actions and tests: getState / setState / subscribe. */
export const editorStore = useEditorStore

export function resetEditorStore(): void {
  editorStore.setState(initialEditorState, true)
}

/**
 * Subscribe to a slice. The selector must return a primitive or a reference already in state;
 * building a new object per call causes an infinite render loop.
 */
export function useEditor<S>(selector: (s: EditorState) => S): S {
  return useEditorStore(selector)
}

/** New document: fitted into the viewport (≥ 50 px margins, 12–300 %), channels reset. */
export function setDocument(s: EditorState, doc: ImageDocument): EditorState {
  const img = doc.versions[doc.currentIndex]?.image
  const zoom = s.viewport && img ? fitZoom(img, s.viewport) : 1
  return {
    ...s,
    doc,
    view: { zoom, scrollX: 0, scrollY: 0 },
    channels: ALL_CHANNELS_ON,
    picked: null,
  }
}

export function closeDocument(s: EditorState): EditorState {
  return {
    ...s,
    doc: null,
    dialog: null,
    view: initialView,
    channels: ALL_CHANNELS_ON,
    picked: null,
  }
}

function currentLayout(s: EditorState): ChannelLayout | null {
  const v = s.doc ? s.doc.versions[s.doc.currentIndex] : undefined
  return v ? v.layout : null
}

/** Toggle one channel; the last visible channel of the image cannot be switched off. */
export function toggleChannel(s: EditorState, id: ChannelId): EditorState {
  const next = { ...s.channels, [id]: !s.channels[id] }
  const layout = currentLayout(s)
  if (layout && !channelsForLayout(layout).some((c) => next[c])) return s
  return { ...s, channels: next }
}

/** Show only one channel (click on a channel row). */
export function soloChannel(s: EditorState, id: ChannelId): EditorState {
  const channels = { gray: false, r: false, g: false, b: false, a: false, [id]: true }
  return { ...s, channels }
}

/** Composite row: every colour channel on; alpha keeps its state. */
export function showAllColourChannels(s: EditorState): EditorState {
  return { ...s, channels: { ...s.channels, gray: true, r: true, g: true, b: true } }
}

export function setDialog(s: EditorState, dialog: DialogKind): EditorState {
  return s.dialog === dialog ? s : { ...s, dialog }
}
