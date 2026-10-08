import { describe, expect, it } from 'vitest'
import { convolve3x3, PRESETS } from '@/shared/lib/image'
import { createRaster } from '@/shared/lib/image'
import { handleRequest } from './protocol'
import { createInProcessRunner } from './runner'

const params = {
  kernel: PRESETS.box.kernel,
  channels: { r: true, g: true, b: true, a: false },
  mode: 'replicate' as const,
  levelMax: 255 as const,
}

function image() {
  const img = createRaster(3, 3)
  for (let i = 0; i < 9; i++) img.data.set([i * 20, i * 10, 5, 255], i * 4)
  return img
}

describe('worker protocol and runner', () => {
  it('in-process result equals core; source sent once; original intact', async () => {
    const runner = createInProcessRunner()
    const src = image()
    const copy = src.data.slice()
    const a = await runner.convolve(src, params)
    const b = await runner.convolve(src, { ...params, mode: 'black' })
    expect(a?.data).toEqual(convolve3x3(src, params.kernel, params.channels, 'replicate').data)
    expect(b).not.toBeNull()
    expect(runner.sentSources()).toBe(1)
    expect(src.data).toEqual(copy)
    expect(src.data.byteLength).toBe(36)
  })
  it('stale job resolves null; latest wins', async () => {
    const runner = createInProcessRunner()
    const src = image()
    const first = runner.convolve(src, params)
    const second = runner.convolve(src, { ...params, kernel: PRESETS.identity.kernel })
    expect(await first).toBeNull()
    expect((await second)?.data).toEqual(src.data)
  })
  it('missing source → error reply', () => {
    const { reply } = handleRequest(
      { type: 'run', jobId: 1, key: 'x', op: { kind: 'convolve', params } },
      new Map(),
    )
    expect(reply?.type).toBe('error')
  })
  it('intermediate preview requests are dropped before computing', async () => {
    const runner = createInProcessRunner()
    const src = image()
    const a = runner.convolve(src, params)
    const b = runner.convolve(src, { ...params, mode: 'black' })
    const c = runner.convolve(src, { ...params, mode: 'white' })
    expect(await b).toBeNull()
    expect(await a).toBeNull()
    expect(await c).not.toBeNull()
    expect(runner.computed()).toBe(2)
  })
  it('apply lane is not superseded by previews', async () => {
    const runner = createInProcessRunner()
    const src = image()
    const apply = runner.convolve(src, params, 'apply')
    const preview = runner.convolve(src, { ...params, kernel: PRESETS.identity.kernel }, 'preview')
    expect((await apply)?.data).toEqual(
      convolve3x3(src, params.kernel, params.channels, 'replicate').data,
    )
    expect(await preview).not.toBeNull()
  })
})
