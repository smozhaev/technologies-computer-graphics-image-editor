import { describe, expect, it } from 'vitest'
import { createRaster, type SourceInfo } from '@/shared/lib/image'
import { createDocument, pushVersion } from '../model/document'
import { formatLabel, formatStatusText } from './status-text'

const src = (o: Partial<SourceInfo>): SourceInfo => ({
  format: 'png',
  fileName: 'a',
  bitDepth: 24,
  depthLabel: '24 бит (RGB)',
  sourceWidth: 1,
  sourceHeight: 1,
  gb7HasMask: false,
  ...o,
})

describe('status text', () => {
  it('empty', () => expect(formatStatusText(null)).toBe('Откройте изображение (Ctrl+O)'))
  it('png and gb7', () => {
    const png = createDocument(src({}), {
      image: createRaster(1920, 1080),
      layout: 'rgb',
      levelMax: 255,
    })
    expect(formatStatusText(png)).toBe('1920 × 1080 px · 24 бит (RGB) · PNG')
    const gb7 = createDocument(src({ format: 'gb7', depthLabel: '8 бит (7 + маска)' }), {
      image: createRaster(512, 512),
      layout: 'gray-alpha',
      levelMax: 127,
    })
    expect(formatStatusText(gb7)).toBe('512 × 512 px · 8 бит (7 + маска) · GB7')
  })
  it('uses current version size', () => {
    let doc = createDocument(src({}), { image: createRaster(4, 4), layout: 'rgb', levelMax: 255 })
    doc = pushVersion(doc, 'r', { image: createRaster(2, 3), layout: 'rgb', levelMax: 255 })
    expect(formatStatusText(doc)).toMatch(/^2 × 3 px/)
  })
  it('labels', () => {
    expect([formatLabel('png'), formatLabel('jpeg'), formatLabel('gb7')]).toEqual([
      'PNG',
      'JPG',
      'GB7',
    ])
  })
})
