import { describe, expect, it } from 'vitest'
import { HeaderError } from './header-info'
import { readJpegHeader } from './jpeg-header'
import { readPngHeader } from './png-header'
import { buildJpeg, buildPng, segment, sof } from '@/shared/lib/test'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEED = 20261006
const parsers = [readPngHeader, readJpegHeader]

function check(bytes: Uint8Array, label: string) {
  for (const parse of parsers) {
    try {
      parse(bytes)
    } catch (e) {
      if (!(e instanceof HeaderError)) throw new Error(`${label}: ${String(e)}`, { cause: e })
    }
  }
}

describe('header parser fuzz', () => {
  it('only HeaderError, never hangs', () => {
    const rnd = mulberry32(SEED)
    const png = buildPng({
      width: 3,
      height: 2,
      bitDepth: 8,
      colorType: 3,
      chunks: [
        { type: 'PLTE', data: [1, 2, 3] },
        { type: 'tRNS', data: [0] },
        { type: 'IDAT', data: [0] },
      ],
    })
    const jpg = buildJpeg(
      segment(0xe0, [1, 2]),
      [0xff, 0xd0],
      sof(0xc0, 8, 2, 3, 3),
      segment(0xda, [0]),
    )
    for (let k = 0; k < 500; k++) {
      const len = Math.floor(rnd() * 257)
      const b = new Uint8Array(len).map(() => Math.floor(rnd() * 256))
      if (k % 2 === 0) b.set((k % 4 === 0 ? png : jpg).slice(0, Math.min(len, 8)))
      check(b, `seed ${SEED} random #${k}`)
    }
    for (const valid of [png, jpg]) {
      for (let n = 0; n <= valid.length; n++) check(valid.slice(0, n), `prefix ${n}`)
      for (let k = 0; k < 200; k++) {
        const m = valid.slice()
        m[Math.floor(rnd() * m.length)] = Math.floor(rnd() * 256)
        check(m, `mutation #${k}`)
      }
    }
    expect(true).toBe(true)
  })
})
