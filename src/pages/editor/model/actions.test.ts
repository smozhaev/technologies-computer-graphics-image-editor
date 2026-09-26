import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRaster, type ImageDocument } from '@/shared/lib/image'
import { buildPng } from '@/shared/lib/test'
import { decodeWithBrowser } from '@/shared/lib/io'
import { downloadBlob } from '@/shared/lib/io'
import { encodeWithBrowser } from '@/shared/lib/io'
import { gb7File } from '@/shared/lib/test'
import { openFile } from '@/features/open-file'
import { saveAs, SaveError } from '@/features/save-file'
import { createDocument, pushVersion } from '@/entities/document'
import { editorStore, resetEditorStore, setDialog } from '@/entities/editor'

vi.mock('@/shared/lib/io/decode-browser', () => ({ decodeWithBrowser: vi.fn() }))
vi.mock('@/shared/lib/io/encode-browser', () => ({
  encodeWithBrowser: vi.fn(
    async (_i, o: { format: string }) => new Blob([], { type: `image/${o.format}` }),
  ),
}))
vi.mock('@/shared/lib/io/download', () => ({ downloadBlob: vi.fn() }))

const decode = vi.mocked(decodeWithBrowser)
const encode = vi.mocked(encodeWithBrowser)
const download = vi.mocked(downloadBlob)

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function docWith(gb7HasMask = false, format: 'png' | 'gb7' = 'png'): ImageDocument {
  const img = createRaster(1, 1)
  img.data.set([10, 20, 30, 0])
  return createDocument(
    {
      format,
      fileName: 'p.png',
      bitDepth: 32,
      depthLabel: '',
      sourceWidth: 1,
      sourceHeight: 1,
      gb7HasMask,
    },
    { image: img, layout: 'rgba', levelMax: 255 },
  )
}

beforeEach(resetEditorStore)
afterEach(() => vi.clearAllMocks())

describe('openFile', () => {
  it('success sets doc', async () => {
    expect(await openFile(gb7File(2, 2))).toEqual({ status: 'opened' })
    expect(editorStore.getState().doc?.source.format).toBe('gb7')
    expect(editorStore.getState().busy).toBe(false)
  })
  it('error keeps previous doc', async () => {
    await openFile(gb7File(2, 2))
    const prev = editorStore.getState().doc
    const r = await openFile(new File(['hello'], 'bad.png'))
    expect(r.status).toBe('error')
    expect(editorStore.getState().doc).toBe(prev)
    expect(editorStore.getState().busy).toBe(false)
  })
  it('race: later open wins', async () => {
    const slow = deferred<ReturnType<typeof createRaster>>()
    decode.mockReturnValueOnce(slow.promise)
    const png = new File([buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 2 })], 'slow.png')
    const first = openFile(png)
    const second = await openFile(gb7File(3, 3))
    slow.resolve(createRaster(1, 1))
    expect(second.status).toBe('opened')
    expect(await first).toEqual({ status: 'stale' })
    expect(editorStore.getState().doc?.source.format).toBe('gb7')
  })
  it('large image warning', async () => {
    decode.mockResolvedValueOnce({
      width: 10000,
      height: 6000,
      data: new Uint8ClampedArray(4),
    } as never)
    const r = await openFile(
      new File([buildPng({ width: 10000, height: 6000, bitDepth: 8, colorType: 2 })], 'big.png'),
    )
    expect(r).toMatchObject({ status: 'opened', warning: expect.stringMatching(/60 МП/) })
  })
})

describe('saveAs', () => {
  beforeEach(() => editorStore.setState((s) => setDialog({ ...s, doc: docWith() }, 'save')))

  it('png', async () => {
    await saveAs({ format: 'png', name: 'out' })
    expect(encode).toHaveBeenCalledWith(expect.anything(), { format: 'png' })
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'out.png')
    expect(editorStore.getState().dialog).toBeNull()
  })
  it('jpeg flattens onto background, quality 1–100', async () => {
    await saveAs({ format: 'jpeg', name: 'o', quality: 80, background: { r: 1, g: 2, b: 3 } })
    const [img, opts] = encode.mock.calls[0]!
    expect(Array.from(img.data)).toEqual([1, 2, 3, 255])
    expect(opts).toEqual({ format: 'jpeg', quality: 80 })
    expect(download.mock.calls[0]?.[1]).toBe('o.jpg')
  })
  it('gb7 uses own codec; mask default by source', async () => {
    await saveAs({ format: 'gb7', name: 'g' })
    const blob = download.mock.calls[0]![0]
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(bytes[0]).toBe(0x47)
    expect(bytes[5]).toBe(1) // alpha 0 → auto sets mask
    expect(download.mock.calls[0]?.[1]).toBe('g.gb7')
    expect(encode).not.toHaveBeenCalled()

    editorStore.setState((s) => setDialog({ ...s, doc: docWith(true, 'gb7') }, 'save'))
    const opaque = createRaster(1, 1)
    opaque.data.fill(255)
    editorStore.setState((s) => ({
      ...s,
      doc: pushVersion(s.doc!, 'x', { image: opaque, layout: 'gray', levelMax: 127 }),
    }))
    await saveAs({ format: 'gb7', name: 'g' })
    const b2 = new Uint8Array(await download.mock.calls[1]![0].arrayBuffer())
    expect(b2[5]).toBe(1) // 'always' because source had mask
  })
  it('saves current version, not versions[0]', async () => {
    const other = createRaster(1, 1)
    other.data.set([200, 200, 200, 255])
    editorStore.setState((s) => ({
      ...s,
      doc: pushVersion(s.doc!, 'v2', { image: other, layout: 'rgb', levelMax: 255 }),
    }))
    await saveAs({ format: 'jpeg', name: 'x' })
    expect(Array.from(encode.mock.calls[0]![0].data)).toEqual([200, 200, 200, 255])
  })
  it('failure → SaveError, dialog stays', async () => {
    encode.mockRejectedValueOnce(new Error('Не удалось закодировать'))
    await expect(saveAs({ format: 'png', name: 'x' })).rejects.toBeInstanceOf(SaveError)
    expect(editorStore.getState().dialog).toBe('save')
    expect(editorStore.getState().busy).toBe(false)
  })
  it('no document → SaveError', async () => {
    resetEditorStore()
    await expect(saveAs({ format: 'png', name: 'x' })).rejects.toBeInstanceOf(SaveError)
  })
})
