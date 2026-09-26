import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeWithBrowser } from './decode-browser'
import { BrowserImageError } from './errors'

function mockCanvas(pixels: number[], getImageData?: () => ImageData) {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(getImageData ?? (() => new ImageData(new Uint8ClampedArray(pixels), 2, 1))),
  }
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
  return { ctx, spy }
}

function mockBitmap() {
  const bitmap = { width: 2, height: 1, close: vi.fn() }
  const create = vi.fn(async () => bitmap)
  vi.stubGlobal('createImageBitmap', create)
  return { bitmap, create }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('decodeWithBrowser', () => {
  it('decodes via bitmap and getImageData, closes bitmap', async () => {
    const { bitmap, create } = mockBitmap()
    const { ctx, spy } = mockCanvas([1, 2, 3, 4, 5, 6, 7, 8])
    const img = await decodeWithBrowser(new Uint8Array([1]), 'image/png')
    const [blob, opts] = create.mock.calls[0] as unknown as [Blob, ImageBitmapOptions]
    expect(blob.type).toBe('image/png')
    expect(opts).toEqual({
      imageOrientation: 'from-image',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
    expect(spy).toHaveBeenCalledWith('2d', { willReadFrequently: true })
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0)
    expect([img.width, img.height]).toEqual([2, 1])
    expect(Array.from(img.data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(bitmap.close).toHaveBeenCalled()
  })
  it('closes bitmap when getImageData throws', async () => {
    const { bitmap } = mockBitmap()
    mockCanvas([], () => {
      throw new Error('boom')
    })
    await expect(decodeWithBrowser(new Uint8Array([1]), 'image/png')).rejects.toBeInstanceOf(
      BrowserImageError,
    )
    expect(bitmap.close).toHaveBeenCalled()
  })
  it('createImageBitmap rejection → BrowserImageError', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => Promise.reject(new Error('x'))),
    )
    await expect(decodeWithBrowser(new Uint8Array([1]), 'image/jpeg')).rejects.toThrow(
      /не смог декодировать/,
    )
  })
  it('gray option normalises', async () => {
    mockBitmap()
    mockCanvas([10, 12, 9, 255, 50, 40, 30, 255])
    const img = await decodeWithBrowser(new Uint8Array([1]), 'image/png', { gray: true })
    expect(Array.from(img.data)).toEqual([10, 10, 10, 255, 50, 50, 50, 255])
  })
})
