import type { ChannelLayout } from '../image'

export interface HeaderInfo {
  width: number
  height: number
  layout: ChannelLayout
  /** Bits per pixel as stored in the file (palette: index depth). */
  bitDepth: number
  depthLabel: string
}

export class HeaderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HeaderError'
  }
}

export type DepthKind = 'gray' | 'gray-alpha' | 'rgb' | 'rgba' | 'palette' | 'cmyk'

const KIND_LABEL: Record<DepthKind, (n: number) => string> = {
  gray: (n) => `${n} бит (оттенки серого)`,
  'gray-alpha': (n) => `${n} бит (оттенки серого + альфа)`,
  rgb: (n) => `${n} бит (RGB)`,
  rgba: (n) => `${n} бит (RGBA)`,
  palette: (n) => `${n} бит, палитра`,
  cmyk: (n) => `${n} бит (CMYK)`,
}

export function formatDepthLabel(
  bitDepth: number,
  kind: DepthKind,
  opts?: { trns?: boolean },
): string {
  return KIND_LABEL[kind](bitDepth) + (opts?.trns ? ', прозрачность tRNS' : '')
}

/** Used when header parsing failed but the browser decoded the image. */
export function fallbackHeaderInfo(width: number, height: number, hasAlpha: boolean): HeaderInfo {
  return hasAlpha
    ? { width, height, layout: 'rgba', bitDepth: 32, depthLabel: formatDepthLabel(32, 'rgba') }
    : { width, height, layout: 'rgb', bitDepth: 24, depthLabel: formatDepthLabel(24, 'rgb') }
}
