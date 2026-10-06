import { describe, expect, it } from 'vitest'
import { createRaster, resizeImage } from '@/shared/lib/image'
import { handleRequest } from './protocol'
import { createInProcessRunner } from './runner'

const params = { width: 6, height: 6, method: 'bilinear' as const, levelMax: 255 as const }

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
    const a = await runner.resize(src, params)
    const b = await runner.resize(src, { ...params, method: 'nearest' })
    expect(a?.data).toEqual(resizeImage(src, 6, 6, 'bilinear', 255).data)
    expect(b?.width).toBe(6)
    expect(runner.sentSources()).toBe(1)
    expect(src.data).toEqual(copy)
    expect(src.data.byteLength).toBe(36)
  })
  it('stale job resolves null; latest wins', async () => {
    const runner = createInProcessRunner()
    const src = image()
    const first = runner.resize(src, params)
    const second = runner.resize(src, { ...params, width: 3, height: 3, method: 'nearest' })
    expect(await first).toBeNull()
    expect((await second)?.data).toEqual(src.data)
  })
  it('missing source → error reply', () => {
    const { reply } = handleRequest(
      { type: 'run', jobId: 1, key: 'x', op: { kind: 'resize', params } },
      new Map(),
    )
    expect(reply?.type).toBe('error')
  })
  it('intermediate requests are dropped before computing', async () => {
    const runner = createInProcessRunner()
    const src = image()
    const a = runner.resize(src, params)
    const b = runner.resize(src, { ...params, width: 4 })
    const c = runner.resize(src, { ...params, width: 5 })
    expect(await b).toBeNull()
    expect(await a).toBeNull()
    expect((await c)?.width).toBe(5)
    expect(runner.computed()).toBe(2)
  })
})
