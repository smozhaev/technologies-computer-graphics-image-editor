import { describe, expect, it } from 'vitest'
import { HeaderError } from './header-info'
import { readJpegHeader } from './jpeg-header'
import { buildJpeg, segment, sof } from '@/shared/lib/test'

describe('readJpegHeader', () => {
  it('SOF0 3 comps 8-bit → 24 rgb', () => {
    expect(readJpegHeader(buildJpeg(sof(0xc0, 8, 480, 640, 3)))).toEqual({
      width: 640,
      height: 480,
      layout: 'rgb',
      bitDepth: 24,
      depthLabel: '24 бит (RGB)',
    })
  })
  it('SOF2 1 comp → 8 gray', () => {
    expect(readJpegHeader(buildJpeg(sof(0xc2, 8, 2, 2, 1)))).toMatchObject({
      layout: 'gray',
      bitDepth: 8,
    })
  })
  it('4 comps → CMYK 32, layout rgb', () => {
    expect(readJpegHeader(buildJpeg(sof(0xc0, 8, 2, 2, 4)))).toMatchObject({
      layout: 'rgb',
      bitDepth: 32,
      depthLabel: '32 бит (CMYK)',
    })
  })
  it('12-bit precision → 36', () => {
    expect(readJpegHeader(buildJpeg(sof(0xc1, 12, 2, 2, 3))).bitDepth).toBe(36)
  })
  it('skips APP/DQT/DHT, C4/C8/CC are not SOF', () => {
    const b = buildJpeg(
      segment(0xe0, [1, 2, 3]),
      segment(0xe1, [4]),
      segment(0xdb, [0]),
      segment(0xc4, [0, 0, 0, 0, 0, 0, 0]),
      segment(0xc8, [0, 0, 0, 0, 0, 0, 0]),
      segment(0xcc, [0, 0, 0, 0, 0, 0, 0]),
      sof(0xc0, 8, 5, 6, 3),
    )
    expect(readJpegHeader(b)).toMatchObject({ width: 6, height: 5 })
  })
  it('fill bytes and standalone markers skipped', () => {
    const b = buildJpeg([0xff, 0xff, 0xd0], [0xff, 0x01], [0xff, 0xff], sof(0xc0, 8, 1, 1, 3))
    expect(readJpegHeader(b).width).toBe(1)
  })
  it('errors', () => {
    expect(() => readJpegHeader(new Uint8Array([0x00, 0xd8, 0xff, 0xc0]))).toThrow(HeaderError)
    expect(() => readJpegHeader(buildJpeg([0xff, 0xe0, 0x00, 0x01]))).toThrow(HeaderError)
    expect(() => readJpegHeader(buildJpeg([0xff, 0xe0, 0x00, 0x40, 1]))).toThrow(HeaderError)
    expect(() => readJpegHeader(buildJpeg(segment(0xda, [0, 0])))).toThrow(HeaderError)
    expect(() => readJpegHeader(buildJpeg([0xff, 0xd9]))).toThrow(HeaderError)
    expect(() => readJpegHeader(buildJpeg(segment(0xe0, [1])))).toThrow(HeaderError)
    expect(() => readJpegHeader(buildJpeg(sof(0xc0, 8, 2, 2, 2)))).toThrow(HeaderError)
    expect(() => readJpegHeader(buildJpeg(sof(0xc0, 8, 0, 2, 3)))).toThrow(HeaderError)
    expect(() => readJpegHeader(buildJpeg(segment(0xc0, [8, 0, 2, 0, 2, 3])))).toThrow(HeaderError)
  })
  it('input unchanged', () => {
    const b = buildJpeg(sof(0xc0, 8, 2, 2, 3))
    const copy = b.slice()
    readJpegHeader(b)
    expect(b).toEqual(copy)
  })
})
