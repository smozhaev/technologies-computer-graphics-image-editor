import 'fake-indexeddb/auto'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDocument, currentVersion, pushVersion } from '@/entities/document'
import { closeDocument, editorStore, resetEditorStore, setDocument } from '@/entities/editor'
import { revertToOriginal } from '@/features/undo-version'
import { createRaster, type RasterImage } from '@/shared/lib/image'
import {
  clearSession,
  loadSession,
  restoreDocument,
  saveSession,
  usePersistSession,
} from './session'

function solid(v: number): RasterImage {
  const img = createRaster(2, 2)
  img.data.fill(v)
  return img
}
const source = {
  format: 'png' as const,
  fileName: 'a.png',
  bitDepth: 24,
  depthLabel: '24 бит (RGB)',
  sourceWidth: 2,
  sourceHeight: 2,
  gb7HasMask: false,
}
const docWithEdit = () =>
  pushVersion(
    createDocument(source, { image: solid(10), layout: 'rgb', levelMax: 255 }),
    'Уровни',
    { image: solid(99), layout: 'rgb', levelMax: 255 },
  )

function Harness() {
  usePersistSession()
  return null
}

beforeEach(async () => {
  resetEditorStore()
  await clearSession()
})

describe('persist session', () => {
  it('save → load → restore keeps original and current', async () => {
    await saveSession(docWithEdit(), { zoom: 2, scrollX: 5, scrollY: 6 })
    const saved = await loadSession()
    expect(saved?.view).toEqual({ zoom: 2, scrollX: 5, scrollY: 6 })
    const doc = restoreDocument(saved!)
    expect(doc.versions).toHaveLength(2)
    expect(doc.versions[0]!.image.data[0]).toBe(10)
    expect(currentVersion(doc).image.data[0]).toBe(99)
    expect(currentVersion(doc).label).toBe('Уровни')
  })

  it('hook saves after a change, restores after a reload, clears on close', async () => {
    const first = render(<Harness />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    act(() => editorStore.setState((s) => setDocument(s, docWithEdit())))
    await waitFor(async () => expect((await loadSession())?.current.image.data[0]).toBe(99), {
      timeout: 2000,
    })
    first.unmount()

    resetEditorStore()
    const second = render(<Harness />)
    await waitFor(() => expect(editorStore.getState().doc).not.toBeNull())
    expect(currentVersion(editorStore.getState().doc!).image.data[0]).toBe(99)

    act(() => editorStore.setState(closeDocument))
    await waitFor(async () => expect(await loadSession()).toBeUndefined())
    second.unmount()
  })

  it('revert to original is an undoable version', () => {
    act(() => editorStore.setState((s) => setDocument(s, docWithEdit())))
    revertToOriginal()
    const doc = editorStore.getState().doc!
    expect(doc.versions).toHaveLength(3)
    expect(currentVersion(doc).label).toBe('Исходное')
    expect(currentVersion(doc).image.data[0]).toBe(10)
  })
})
