import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRaster } from '@/shared/lib/image'
import { createDocument } from '@/entities/document'
import { editorStore, resetEditorStore, setDocument } from '@/entities/editor'
import { renderWithProviders } from '@/shared/lib/test'
import { Viewport } from './Viewport'

function size(w: number, h: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(w)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(h)
}
function load(w: number, h: number, name = 'a') {
  const doc = createDocument(
    {
      format: 'png',
      fileName: name,
      bitDepth: 24,
      depthLabel: '',
      sourceWidth: w,
      sourceHeight: h,
      gb7HasMask: false,
    },
    { image: createRaster(w, h), layout: 'rgb', levelMax: 255 },
  )
  act(() =>
    editorStore.setState((s) => ({
      ...setDocument(s, doc),
      view: { zoom: 1, scrollX: 0, scrollY: 0 },
    })),
  )
}

beforeEach(resetEditorStore)
afterEach(() => vi.restoreAllMocks())

describe('Viewport', () => {
  it('no document → hint, no canvas', () => {
    size(100, 80)
    const { container } = renderWithProviders(<Viewport />)
    expect(container.querySelector('canvas')).toBeNull()
    expect(screen.getByText(/перетащите файл/)).toBeInTheDocument()
  })
  it('spacer = image size when larger, viewport size when smaller; canvas = viewport', () => {
    size(100, 80)
    const { container } = renderWithProviders(<Viewport />)
    load(300, 200)
    const spacer = screen.getByTestId('viewport-spacer')
    expect([spacer.style.width, spacer.style.height]).toEqual(['300px', '200px'])
    expect(container.querySelector('canvas')!.style.width).toBe('100px')
    load(50, 40, 'b')
    expect([spacer.style.width, spacer.style.height]).toEqual(['100px', '80px'])
  })
  it('scroll updates store; new document resets', () => {
    size(100, 80)
    renderWithProviders(<Viewport />)
    load(300, 200)
    const region = screen.getByRole('region', { name: 'Холст' })
    region.scrollLeft = 30
    region.scrollTop = 12
    fireEvent.scroll(region)
    expect(editorStore.getState().view).toMatchObject({ scrollX: 30, scrollY: 12 })
    load(300, 200, 'c')
    expect(editorStore.getState().view).toMatchObject({ scrollX: 0, scrollY: 0 })
    expect(region.scrollLeft).toBe(0)
  })
})
