import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { EditorPage } from './EditorPage'
import { createRaster } from '@/shared/lib/image'
import { setViewportSize } from '@/entities/editor'
import { createDocument } from '@/entities/document'
import { editorStore, resetEditorStore, setDocument } from '@/entities/editor'
import { renderWithProviders } from '@/shared/lib/test'

function load(w: number, h: number) {
  const doc = createDocument(
    {
      format: 'png',
      fileName: 'a',
      bitDepth: 24,
      depthLabel: '',
      sourceWidth: w,
      sourceHeight: h,
      gb7HasMask: false,
    },
    { image: createRaster(w, h), layout: 'rgb', levelMax: 255 },
  )
  act(() => editorStore.setState((s) => setDocument(s, doc)))
}

beforeEach(resetEditorStore)

describe('zoom', () => {
  it('open fits with margins; select and hotkeys change zoom; fit restores', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<EditorPage />)
    act(() => setViewportSize({ cssWidth: 1100, cssHeight: 700, dpr: 1 }))
    load(2000, 1000)
    expect(editorStore.getState().view.zoom).toBeCloseTo(0.5, 9)
    const sel = screen.getAllByLabelText('Масштаб').find((e) => e.tagName === 'INPUT')!
    expect(sel).toHaveValue('50 %')
    await user.click(sel)
    await user.click(await screen.findByRole('option', { name: '200 %' }))
    expect(editorStore.getState().view.zoom).toBe(2)
    fireEvent.keyDown(document.documentElement, { key: '-', code: 'Minus', ctrlKey: true })
    expect(editorStore.getState().view.zoom).toBe(1.5)
    fireEvent.keyDown(document.documentElement, { key: '0', code: 'Digit0', ctrlKey: true })
    expect(editorStore.getState().view.zoom).toBeCloseTo(0.5, 9)
    await user.click(screen.getByRole('button', { name: 'Вписать в окно' }))
    expect(editorStore.getState().view.zoom).toBeCloseTo(0.5, 9)
  })
  it('interpolation select updates state', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<EditorPage />)
    act(() => setViewportSize({ cssWidth: 500, cssHeight: 500, dpr: 1 }))
    load(10, 10)
    expect(editorStore.getState().view.zoom).toBe(3)
    const sel = screen
      .getAllByLabelText('Интерполяция отображения')
      .find((e) => e.tagName === 'INPUT')!
    expect(sel).toHaveValue('Билинейная')
    await user.click(sel)
    await user.click(await screen.findByRole('option', { name: 'Ближайший сосед' }))
    expect(editorStore.getState().interpolation).toBe('nearest')
  })
  it('ctrl+wheel zooms around the cursor; plain wheel does not zoom', () => {
    renderWithProviders(<EditorPage />)
    act(() => setViewportSize({ cssWidth: 1100, cssHeight: 700, dpr: 1 }))
    load(2000, 1000)
    const region = screen.getByRole('region', { name: 'Холст' })
    const z0 = editorStore.getState().view.zoom
    region.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))
    expect(editorStore.getState().view.zoom).toBe(z0)
    const ev = new WheelEvent('wheel', {
      deltaY: -200,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      region.dispatchEvent(ev)
    })
    expect(ev.defaultPrevented).toBe(true)
    expect(editorStore.getState().view.zoom).toBeGreaterThan(z0)
  })
})
