import type { ImageDocument, SourceFormat } from '@/shared/lib/image'

const LABEL: Record<SourceFormat, string> = { png: 'PNG', jpeg: 'JPG', gb7: 'GB7' }

export function formatLabel(format: SourceFormat): string {
  return LABEL[format]
}

/** '1920 × 1080 px · 24 бит (RGB) · PNG'; size from the current version. */
export function formatStatusText(doc: ImageDocument | null): string {
  if (!doc) return 'Откройте изображение (Ctrl+O)'
  const v = doc.versions[doc.currentIndex]
  if (!v) return ''
  return `${v.image.width} × ${v.image.height} px · ${doc.source.depthLabel} · ${formatLabel(doc.source.format)}`
}
