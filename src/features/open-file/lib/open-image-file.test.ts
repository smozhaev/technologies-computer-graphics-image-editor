import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRaster } from '@/shared/lib/image'
import { buildJpeg, buildPng, sof } from '@/shared/lib/test'
import { gb7File, makeGb7 } from '@/shared/lib/test'
import { decodeWithBrowser } from '@/shared/lib/io'
import { openImageFile, OpenFileError } from './open-image-file'

vi.mock('@/shared/lib/io/decode-browser', () => ({ decodeWithBrowser: vi.fn() }))
const decode = vi.mocked(decodeWithBrowser)

function raster(w: number, h: number, alpha = 255) {
  const r = createRaster(w, h)
  r.data.fill(alpha)
  return r
}

afterEach(() => vi.clearAllMocks())

describe('openImageFile', () => {
  it('GB7 without mask', async () => {
    const doc = await openImageFile(gb7File(3, 2))
    expect(doc.source).toMatchObject({
      format: 'gb7',
      bitDepth: 7,
      depthLabel: '7 бит',
      gb7HasMask: false,
      sourceWidth: 3,
      sourceHeight: 2,
    })
    expect(doc.versions[0]).toMatchObject({ label: 'Открыто', layout: 'gray', levelMax: 127 })
    expect(doc.currentIndex).toBe(0)
  })
  it('GB7 with mask', async () => {
    const doc = await openImageFile(gb7File(2, 2, 1))
    expect(doc.source).toMatchObject({
      bitDepth: 8,
      depthLabel: '8 бит (7 + маска)',
      gb7HasMask: true,
    })
    expect(doc.versions[0]?.layout).toBe('gray-alpha')
  })
  it('PNG via browser decode + header; size from raster', async () => {
    decode.mockResolvedValue(raster(5, 7))
    const doc = await openImageFile(
      new File([buildPng({ width: 7, height: 5, bitDepth: 8, colorType: 6 })], 'a.png'),
    )
    expect(decode).toHaveBeenCalledWith(expect.any(Uint8Array), 'image/png', { gray: false })
    expect(doc.source).toMatchObject({
      format: 'png',
      bitDepth: 32,
      sourceWidth: 5,
      sourceHeight: 7,
    })
    expect(doc.versions[0]?.layout).toBe('rgba')
  })
  it('grey PNG requests gray normalisation', async () => {
    decode.mockResolvedValue(raster(1, 1))
    await openImageFile(
      new File([buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 0 })], 'g.png'),
    )
    expect(decode).toHaveBeenCalledWith(expect.any(Uint8Array), 'image/png', { gray: true })
  })
  it('JPEG uses image/jpeg and SOF', async () => {
    decode.mockResolvedValue(raster(2, 2))
    const doc = await openImageFile(new File([buildJpeg(sof(0xc0, 8, 2, 2, 3))], 'a.jpg'))
    expect(decode).toHaveBeenCalledWith(expect.any(Uint8Array), 'image/jpeg', { gray: false })
    expect(doc.source.depthLabel).toBe('24 бит (RGB)')
  })
  it('header failure falls back by transparency and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    decode.mockResolvedValue(raster(1, 1, 10))
    const doc = await openImageFile(
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0, 0])], 'x.jpg'),
    )
    expect(doc.source).toMatchObject({ bitDepth: 32, depthLabel: '32 бит (RGBA)' })
    expect(doc.versions[0]?.layout).toBe('rgba')
    expect(warn).toHaveBeenCalled()
  })
  it('unknown signature mentions extension', async () => {
    await expect(openImageFile(new File(['hello'], 'bad.xyz'))).rejects.toThrow(/\.xyz/)
  })
  it('corrupt GB7 → OpenFileError with codec message', async () => {
    await expect(openImageFile(new File([makeGb7(10, 10, [1])], 'c.gb7'))).rejects.toThrow(
      OpenFileError,
    )
    await expect(openImageFile(new File([makeGb7(10, 10, [1])], 'c.gb7'))).rejects.toThrow(
      /обрезан/,
    )
  })
  it('browser decode failure', async () => {
    decode.mockRejectedValue(new Error('x'))
    await expect(
      openImageFile(
        new File([buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 2 })], 'a.png'),
      ),
    ).rejects.toThrow(/Не удалось декодировать/)
  })
})
