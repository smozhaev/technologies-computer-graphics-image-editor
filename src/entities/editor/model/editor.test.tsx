import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRaster } from '@/shared/lib/image'
import { createDocument } from '@/entities/document'
import {
  closeDocument,
  editorStore,
  initialEditorState,
  resetEditorStore,
  setDialog,
  setDocument,
  useEditor,
} from './editor'

beforeEach(resetEditorStore)

describe('useEditor', () => {
  it('rerenders only when the selected slice changes', () => {
    let renders = 0
    function Busy() {
      renders++
      return <span>{String(useEditor((s) => s.busy))}</span>
    }
    render(<Busy />)
    expect(renders).toBe(1)
    act(() => editorStore.setState((s) => setDialog(s, 'save')))
    expect(renders).toBe(1)
    act(() => editorStore.setState((s) => ({ ...s, busy: true })))
    expect(renders).toBe(2)
  })
})

describe('transitions', () => {
  it('closeDocument clears doc and dialog; setDialog only dialog; setDocument resets view', () => {
    const doc = createDocument(
      {
        format: 'png',
        fileName: 'a',
        bitDepth: 24,
        depthLabel: '',
        sourceWidth: 1,
        sourceHeight: 1,
        gb7HasMask: false,
      },
      { image: createRaster(1, 1), layout: 'rgb', levelMax: 255 },
    )
    const withDoc = setDocument(
      { ...initialEditorState, view: { zoom: 2, scrollX: 5, scrollY: 5 } },
      doc,
    )
    expect(withDoc.view).toEqual(initialEditorState.view)
    const saving = setDialog(withDoc, 'save')
    expect({ ...saving, dialog: null }).toEqual(withDoc)
    const closed = closeDocument(saving)
    expect(closed.doc).toBeNull()
    expect(closed.dialog).toBeNull()
  })
})

describe('editor store', () => {
  it('same reference skips notification; new state notifies once', () => {
    const l = vi.fn()
    const off = editorStore.subscribe(l)
    editorStore.setState((s) => s)
    expect(l).not.toHaveBeenCalled()
    editorStore.setState((s) => setDialog(s, 'save'))
    expect(l).toHaveBeenCalledTimes(1)
    off()
    resetEditorStore()
    expect(editorStore.getState()).toEqual(initialEditorState)
  })
})
