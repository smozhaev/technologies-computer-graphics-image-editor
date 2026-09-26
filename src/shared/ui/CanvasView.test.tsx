import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRaster } from '@/shared/lib/image'
import { CanvasView } from './CanvasView'

let frames: FrameRequestCallback[] = []
const put = vi.fn()

beforeEach(() => {
  frames = []
  put.mockClear()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    putImageData: put,
  } as never)
})
afterEach(() => vi.restoreAllMocks())

const flush = () => {
  const f = frames
  frames = []
  f.forEach((cb) => cb(0))
}

describe('CanvasView', () => {
  it('sizes canvas and puts once per frame with the last raster', () => {
    const a = createRaster(4, 2)
    const { container, rerender } = render(<CanvasView raster={a} cssWidth={2} cssHeight={1} />)
    const canvas = container.querySelector('canvas')!
    expect(canvas.style.width).toBe('2px')
    const b = createRaster(4, 2)
    const c = createRaster(4, 2)
    rerender(<CanvasView raster={b} cssWidth={2} cssHeight={1} />)
    rerender(<CanvasView raster={c} cssWidth={2} cssHeight={1} />)
    flush()
    expect(put).toHaveBeenCalledTimes(1)
    const data = put.mock.calls[0]![0] as ImageData
    expect(data.data.buffer).toBe(c.data.buffer)
    expect([canvas.width, canvas.height]).toEqual([4, 2])
  })
  it('same raster ref → no new put; null → none; unmount cancels', () => {
    const a = createRaster(1, 1)
    const { rerender, unmount } = render(<CanvasView raster={a} cssWidth={1} cssHeight={1} />)
    flush()
    rerender(<CanvasView raster={a} cssWidth={1} cssHeight={1} />)
    flush()
    expect(put).toHaveBeenCalledTimes(1)
    rerender(<CanvasView raster={null} cssWidth={1} cssHeight={1} />)
    flush()
    expect(put).toHaveBeenCalledTimes(1)
    rerender(<CanvasView raster={createRaster(1, 1)} cssWidth={1} cssHeight={1} />)
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })
})
