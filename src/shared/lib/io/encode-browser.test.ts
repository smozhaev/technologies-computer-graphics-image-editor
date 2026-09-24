import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRaster } from '@/shared/lib/image'
import { encodeWithBrowser } from './encode-browser'
import { BrowserImageError } from './errors'

function setup(result: Blob | null) {
  const ctx = { putImageData: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((cb: BlobCallback) => cb(result))
  return { ctx, toBlob }
}

afterEach(() => vi.restoreAllMocks())

describe('encodeWithBrowser', () => {
  it('png: putImageData once, toBlob image/png', async () => {
    const { ctx, toBlob } = setup(new Blob([], { type: 'image/png' }))
    const img = createRaster(2, 2)
    const copy = img.data.slice()
    const blob = await encodeWithBrowser(img, { format: 'png' })
    expect(blob.type).toBe('image/png')
    expect(ctx.putImageData).toHaveBeenCalledTimes(1)
    expect(toBlob.mock.calls[0]?.[1]).toBe('image/png')
    expect(img.data).toEqual(copy)
  })
  it('jpeg quality mapped to 0..1, default 92', async () => {
    const { toBlob } = setup(new Blob([], { type: 'image/jpeg' }))
    await encodeWithBrowser(createRaster(1, 1), { format: 'jpeg', quality: 80 })
    await encodeWithBrowser(createRaster(1, 1), { format: 'jpeg' })
    expect(toBlob.mock.calls[0]?.slice(1)).toEqual(['image/jpeg', 0.8])
    expect(toBlob.mock.calls[1]?.slice(1)).toEqual(['image/jpeg', 0.92])
  })
  it('null blob → BrowserImageError', async () => {
    setup(null)
    await expect(encodeWithBrowser(createRaster(1, 1), { format: 'png' })).rejects.toBeInstanceOf(
      BrowserImageError,
    )
  })
  it('type mismatch → BrowserImageError', async () => {
    setup(new Blob([], { type: 'image/png' }))
    await expect(encodeWithBrowser(createRaster(1, 1), { format: 'jpeg' })).rejects.toThrow(/JPEG/)
  })
})
