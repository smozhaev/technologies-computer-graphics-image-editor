import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from './download'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('downloadBlob', () => {
  it('clicks a temporary anchor and revokes later', () => {
    vi.useFakeTimers()
    const blob = new Blob(['x'])
    const create = vi.mocked(URL.createObjectURL)
    const revoke = vi.mocked(URL.revokeObjectURL)
    revoke.mockClear()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadBlob(blob, 'a.png')
    expect(create).toHaveBeenCalledWith(blob)
    const a = click.mock.contexts[0] as HTMLAnchorElement | undefined
    expect(a?.download).toBe('a.png')
    expect(a?.href).toMatch(/^blob:/)
    expect(a?.isConnected).toBe(false)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith(a?.href)
  })
})
