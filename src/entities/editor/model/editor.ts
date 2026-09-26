import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ViewState, Viewport } from '@/shared/lib/image'
import type { ImageDocument } from '@/shared/lib/image'

export type DialogKind = null | 'save'

export interface EditorState {
  doc: ImageDocument | null
  view: ViewState
  /** Measured canvas area; null until the viewport mounts. */
  viewport: Viewport | null
  activeTool: 'pointer'
  dialog: DialogKind
  busy: boolean
}

export const initialView: ViewState = { zoom: 1, scrollX: 0, scrollY: 0 }

export const initialEditorState: EditorState = {
  doc: null,
  view: initialView,
  viewport: null,
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

/** New document: shown at 100 %, scrolled to the top-left corner. */
export function setDocument(s: EditorState, doc: ImageDocument): EditorState {
  return { ...s, doc, view: initialView }
}

export function closeDocument(s: EditorState): EditorState {
  return {
    ...s,
    doc: null,
    dialog: null,
    view: initialView,
  }
}

export function setDialog(s: EditorState, dialog: DialogKind): EditorState {
  return s.dialog === dialog ? s : { ...s, dialog }
}
