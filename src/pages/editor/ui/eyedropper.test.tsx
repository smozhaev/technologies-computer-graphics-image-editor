import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorPage } from './EditorPage'
import { createRaster } from '@/shared/lib/image'
import { createDocument } from '@/entities/document'
import { editorStore, resetEditorStore, setDocument } from '@/entities/editor'
import { renderWithProviders } from '@/shared/lib/test'

function size(w: number, h: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(w)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(h)
}

beforeEach(resetEditorStore)
afterEach(() => vi.restoreAllMocks())

describe('eyedropper', () => {
  it('tool button activates; click reads image coords, RGB and Lab', async () => {
    size(10, 10)
    const user = userEvent.setup()
    renderWithProviders(<EditorPage />)
    const img = createRaster(2, 2)
    img.data.fill(255)
    img.data.set([255, 0, 0, 255], (1 * 2 + 1) * 4)
    act(() =>
      editorStore.setState((s) =>
        setDocument(
          s,
          createDocument(
            {
              format: 'png',
              fileName: 'p.png',
              bitDepth: 24,
              depthLabel: '',
              sourceWidth: 2,
              sourceHeight: 2,
              gb7HasMask: false,
            },
            { image: img, layout: 'rgb', levelMax: 255 },
          ),
        ),
      ),
    )
    act(() => editorStore.setState((s) => ({ ...s, view: { zoom: 1, scrollX: 0, scrollY: 0 } })))
    await user.click(screen.getByRole('button', { name: 'Пипетка (I)' }))
    expect(editorStore.getState().activeTool).toBe('eyedropper')
    const region = screen.getByRole('region', { name: 'Холст' })
    vi.spyOn(region, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect)
    // image 2×2 centred in 10×10 → offset 4; CSS (5.5, 5.5) → pixel (1,1)
    fireEvent.click(region, { clientX: 5.5, clientY: 5.5 })
    const info = screen.getByRole('group', { name: 'Пипетка' })
    const text = info.textContent ?? ''
    expect(text).toContain('X1')
    expect(text).toContain('R255')
    expect(text).toContain('L*53.24')
    expect(within(info).getByText('80.09')).toBeInTheDocument()
    expect(within(info).getByText('#FF0000')).toBeInTheDocument()
    fireEvent.click(region, { clientX: 0, clientY: 0 })
    expect(editorStore.getState().picked?.x).toBe(1)
  })

  it('I and V hotkeys switch tools', () => {
    renderWithProviders(<EditorPage />)
    fireEvent.keyDown(document.documentElement, { key: 'i', code: 'KeyI' })
    expect(editorStore.getState().activeTool).toBe('eyedropper')
    fireEvent.keyDown(document.documentElement, { key: 'v', code: 'KeyV' })
    expect(editorStore.getState().activeTool).toBe('pointer')
  })
})
