import { describe, expect, it } from 'vitest'
import { fallbackHeaderInfo, formatDepthLabel, HeaderError } from './header-info'

describe('header-info', () => {
  it('formatDepthLabel', () => {
    expect(formatDepthLabel(24, 'rgb')).toBe('24 бит (RGB)')
    expect(formatDepthLabel(32, 'rgba')).toBe('32 бит (RGBA)')
    expect(formatDepthLabel(8, 'gray')).toBe('8 бит (оттенки серого)')
    expect(formatDepthLabel(8, 'palette')).toBe('8 бит, палитра')
    expect(formatDepthLabel(8, 'palette', { trns: true })).toBe('8 бит, палитра, прозрачность tRNS')
    expect(formatDepthLabel(32, 'cmyk')).toBe('32 бит (CMYK)')
  })
  it('fallbackHeaderInfo', () => {
    expect(fallbackHeaderInfo(3, 4, false)).toEqual({
      width: 3,
      height: 4,
      layout: 'rgb',
      bitDepth: 24,
      depthLabel: '24 бит (RGB)',
    })
    expect(fallbackHeaderInfo(3, 4, true)).toMatchObject({
      layout: 'rgba',
      bitDepth: 32,
      depthLabel: '32 бит (RGBA)',
    })
  })
  it('HeaderError identity', () => {
    const e = new HeaderError('x')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(HeaderError)
    expect(e.name).toBe('HeaderError')
  })
})
