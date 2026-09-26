import { describe, expect, it } from 'vitest'
import { createRaster, type SourceInfo } from '@/shared/lib/image'
import {
  createDocument,
  currentVersion,
  deriveLayout,
  pushVersion,
  undo,
  type VersionPayload,
} from './document'

const source: SourceInfo = {
  format: 'png',
  fileName: 'a.png',
  bitDepth: 24,
  depthLabel: '24 бит (RGB)',
  sourceWidth: 2,
  sourceHeight: 2,
  gb7HasMask: false,
}

function payload(alpha = 255): VersionPayload {
  const image = createRaster(2, 2)
  image.data.fill(alpha)
  return { image, layout: 'rgb', levelMax: 255 }
}

describe('document versions', () => {
  it('createDocument has one version «Открыто»', () => {
    const doc = createDocument(source, payload())
    expect(doc.versions).toHaveLength(1)
    expect(doc.versions[0]?.label).toBe('Открыто')
    expect(doc.currentIndex).toBe(0)
    expect(currentVersion(doc)).toBe(doc.versions[0])
  })

  it('deriveLayout upgrades only when transparency appears', () => {
    expect(deriveLayout(payload(100).image, 'rgb')).toBe('rgba')
    expect(deriveLayout(payload(100).image, 'gray')).toBe('gray-alpha')
    expect(deriveLayout(payload(255).image, 'rgb')).toBe('rgb')
    expect(deriveLayout(payload(255).image, 'rgba')).toBe('rgba')
    expect(deriveLayout(payload(255).image, 'gray-alpha')).toBe('gray-alpha')
  })

  it('pushVersion appends immutably with unique ids', () => {
    const doc = createDocument(source, payload())
    const versionsBefore = doc.versions
    const next = pushVersion(doc, 'Уровни', payload())
    expect(next).not.toBe(doc)
    expect(doc.versions).toBe(versionsBefore)
    expect(doc.versions).toHaveLength(1)
    expect(next.versions.map((v) => v.id)).toEqual([1, 2])
    expect(next.currentIndex).toBe(1)
  })

  it('pushVersion after undo truncates redo tail', () => {
    let doc = createDocument(source, payload())
    doc = pushVersion(doc, 'a', payload())
    doc = pushVersion(doc, 'b', payload())
    doc = undo(doc)
    doc = pushVersion(doc, 'c', payload())
    expect(doc.versions.map((v) => v.label)).toEqual(['Открыто', 'a', 'c'])
    expect(doc.versions.map((v) => v.id)).toEqual([1, 2, 3])
  })

  it('count cap drops oldest non-first version', () => {
    let doc = createDocument(source, payload())
    for (let i = 1; i <= 10; i++) doc = pushVersion(doc, `v${i}`, payload())
    expect(doc.versions).toHaveLength(10)
    expect(doc.versions[0]?.label).toBe('Открыто')
    expect(doc.versions[1]?.label).toBe('v2')
    expect(doc.currentIndex).toBe(9)
    expect(currentVersion(doc).label).toBe('v10')
  })

  it('byte cap keeps first and new version', () => {
    const limits = { maxVersions: 100, maxBytes: 16 * 3 }
    let doc = createDocument(source, payload())
    for (let i = 1; i <= 5; i++) doc = pushVersion(doc, `v${i}`, payload(), limits)
    expect(doc.versions.map((v) => v.label)).toEqual(['Открыто', 'v4', 'v5'])
    const tiny = { maxVersions: 100, maxBytes: 1 }
    const d2 = pushVersion(createDocument(source, payload()), 'x', payload(), tiny)
    expect(d2.versions).toHaveLength(2)
  })

  it('undo at 0 is a no-op; otherwise decrements', () => {
    const doc = createDocument(source, payload())
    expect(undo(doc)).toBe(doc)
    const two = pushVersion(doc, 'a', payload())
    expect(undo(two).currentIndex).toBe(0)
    expect(undo(two).versions).toHaveLength(2)
  })
})
