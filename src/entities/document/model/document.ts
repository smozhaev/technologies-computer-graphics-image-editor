import {
  hasTransparency,
  type ChannelLayout,
  type ImageDocument,
  type ImageVersion,
  type RasterImage,
  type SourceInfo,
} from '@/shared/lib/image'

export type { ImageDocument, ImageVersion, SourceInfo }

export const MAX_VERSIONS = 10
export const MAX_VERSION_BYTES = 512 * 1024 * 1024

export interface VersionLimits {
  maxVersions: number
  maxBytes: number
}

/** Result of every apply operation (levels, resize, filter). */
export interface VersionPayload {
  image: RasterImage
  layout: ChannelLayout
  levelMax: 127 | 255
}

export function createDocument(source: SourceInfo, first: VersionPayload): ImageDocument {
  return { source, versions: [{ id: 1, label: 'Открыто', ...first }], currentIndex: 0 }
}

export function currentVersion(doc: ImageDocument): ImageVersion {
  const v = doc.versions[doc.currentIndex]
  if (!v) throw new Error('Нет текущей версии изображения')
  return v
}

/** Upgrades to the alpha layout when transparency appears. Never downgrades. */
export function deriveLayout(image: RasterImage, previous: ChannelLayout): ChannelLayout {
  if (previous === 'rgba' || previous === 'gray-alpha') return previous
  if (!hasTransparency(image)) return previous
  return previous === 'gray' ? 'gray-alpha' : 'rgba'
}

export function versionBytes(versions: readonly ImageVersion[]): number {
  return versions.reduce((sum, v) => sum + v.image.data.byteLength, 0)
}

/** Truncate redo tail, append, enforce cap by dropping versions[1] (never the first or the new one). */
export function pushVersion(
  doc: ImageDocument,
  label: string,
  payload: VersionPayload,
  limits: VersionLimits = { maxVersions: MAX_VERSIONS, maxBytes: MAX_VERSION_BYTES },
): ImageDocument {
  const kept = doc.versions.slice(0, doc.currentIndex + 1)
  const nextId = Math.max(...kept.map((v) => v.id)) + 1
  const versions = [...kept, { id: nextId, label, ...payload }]
  while (
    versions.length > 2 &&
    (versions.length > limits.maxVersions || versionBytes(versions) > limits.maxBytes)
  ) {
    versions.splice(1, 1)
  }
  return { ...doc, versions, currentIndex: versions.length - 1 }
}

export function undo(doc: ImageDocument): ImageDocument {
  if (doc.currentIndex === 0) return doc
  return { ...doc, currentIndex: doc.currentIndex - 1 }
}
