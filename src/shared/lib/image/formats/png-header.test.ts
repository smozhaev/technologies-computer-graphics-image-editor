import { describe, expect, it } from 'vitest'
import { HeaderError } from './header-info'
import { readPngHeader } from './png-header'
import { buildPng } from '@/shared/lib/test'

const base = { width: 4, height: 3 }

describe('readPngHeader', () => {
  it.each([
    [0, 1, 'gray', 1],
    [0, 8, 'gray', 8],
    [0, 16, 'gray', 16],
    [2, 8, 'rgb', 24],
    [2, 16, 'rgb', 48],
    [3, 1, 'rgb', 1],
    [3, 4, 'rgb', 4],
    [3, 8, 'rgb', 8],
    [4, 8, 'gray-alpha', 16],
    [4, 16, 'gray-alpha', 32],
    [6, 8, 'rgba', 32],
    [6, 16, 'rgba', 64],
  ])('type %i depth %i → %s %i', (colorType, bitDepth, layout, total) => {
    const info = readPngHeader(buildPng({ ...base, colorType, bitDepth }))
    expect(info).toMatchObject({ layout, bitDepth: total, width: 4, height: 3 })
  })
  it('labels', () => {
    expect(readPngHeader(buildPng({ ...base, colorType: 6, bitDepth: 16 })).depthLabel).toBe(
      '64 бит (RGBA)',
    )
    expect(readPngHeader(buildPng({ ...base, colorType: 3, bitDepth: 8 })).depthLabel).toBe(
      '8 бит, палитра',
    )
  })
  it('big-endian u32 size', () => {
    expect(
      readPngHeader(buildPng({ width: 70000, height: 3, colorType: 2, bitDepth: 8 })),
    ).toMatchObject({ width: 70000, height: 3 })
  })
  it('tRNS before IDAT adds alpha', () => {
    const pal = readPngHeader(
      buildPng({
        ...base,
        colorType: 3,
        bitDepth: 8,
        chunks: [
          { type: 'PLTE', data: [0, 0, 0] },
          { type: 'tRNS', data: [0] },
        ],
      }),
    )
    expect(pal).toMatchObject({
      layout: 'rgba',
      bitDepth: 8,
      depthLabel: '8 бит, палитра, прозрачность tRNS',
    })
    expect(
      readPngHeader(
        buildPng({ ...base, colorType: 0, bitDepth: 8, chunks: [{ type: 'tRNS', data: [0, 0] }] }),
      ).layout,
    ).toBe('gray-alpha')
    const rgb = readPngHeader(
      buildPng({
        ...base,
        colorType: 2,
        bitDepth: 8,
        chunks: [{ type: 'tRNS', data: [0, 0, 0, 0, 0, 0] }],
      }),
    )
    expect(rgb).toMatchObject({ layout: 'rgba', bitDepth: 24 })
  })
  it('tRNS after IDAT ignored; other chunks skipped; no IEND ok', () => {
    const after = buildPng({
      ...base,
      colorType: 2,
      bitDepth: 8,
      chunks: [
        { type: 'gAMA', data: [0, 0, 0, 1] },
        { type: 'tEXt', data: [65] },
        { type: 'IDAT', data: [1] },
        { type: 'tRNS', data: [0] },
      ],
    })
    expect(readPngHeader(after).layout).toBe('rgb')
    expect(
      readPngHeader(buildPng({ ...base, colorType: 2, bitDepth: 8, noEnd: true })).layout,
    ).toBe('rgb')
  })
  it('errors', () => {
    const ok = buildPng({ ...base, colorType: 2, bitDepth: 8 })
    const badSig = ok.slice()
    badSig[0] = 0
    expect(() => readPngHeader(badSig)).toThrow(HeaderError)
    expect(() => readPngHeader(ok.slice(0, 32))).toThrow(HeaderError)
    expect(() =>
      readPngHeader(buildPng({ ...base, colorType: 2, bitDepth: 8, firstType: 'IDAT' })),
    ).toThrow(HeaderError)
    expect(() =>
      readPngHeader(buildPng({ ...base, colorType: 2, bitDepth: 8, ihdrLength: 12 })),
    ).toThrow(HeaderError)
    expect(() =>
      readPngHeader(buildPng({ width: 0, height: 3, colorType: 2, bitDepth: 8 })),
    ).toThrow(HeaderError)
    for (const [colorType, bitDepth] of [
      [2, 4],
      [6, 1],
      [5, 8],
    ] as const) {
      expect(() => readPngHeader(buildPng({ ...base, colorType, bitDepth }))).toThrow(HeaderError)
    }
    const longChunk = buildPng({
      ...base,
      colorType: 2,
      bitDepth: 8,
      chunks: [{ type: 'tEXt', data: [1, 2] }],
      noEnd: true,
    })
    longChunk[33 + 3] = 200 // claims 200 bytes
    expect(() => readPngHeader(longChunk)).toThrow(HeaderError)
  })
  it('input unchanged', () => {
    const bytes = buildPng({ ...base, colorType: 6, bitDepth: 8 })
    const copy = bytes.slice()
    readPngHeader(bytes)
    expect(bytes).toEqual(copy)
  })
})
