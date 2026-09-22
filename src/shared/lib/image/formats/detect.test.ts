import { describe, expect, it } from 'vitest'
import { detectFormat } from './detect'

const u8 = (...b: number[]) => new Uint8Array(b)

describe('detectFormat', () => {
  it('png', () => {
    expect(detectFormat(u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('png')
  })
  it('jpeg', () => {
    expect(detectFormat(u8(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
  })
  it('gb7 (bytes only, extension never used)', () => {
    expect(detectFormat(u8(0x47, 0x42, 0x37, 0x1d, 1))).toBe('gb7')
  })
  it('short or empty buffers → unknown', () => {
    expect(detectFormat(u8(0x47, 0x42))).toBe('unknown')
    expect(detectFormat(u8())).toBe('unknown')
  })
  it('random bytes → unknown', () => {
    expect(detectFormat(u8(1, 2, 3, 4, 5, 6, 7, 8))).toBe('unknown')
  })
})
