import type { SourceFormat } from '../image'

export type DetectedFormat = SourceFormat | 'unknown'

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
export const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const
export const GB7_SIGNATURE = [0x47, 0x42, 0x37, 0x1d] as const

export function startsWith(bytes: Uint8Array, sig: readonly number[]): boolean {
  if (bytes.length < sig.length) return false
  return sig.every((b, i) => bytes[i] === b)
}

/** Detect by magic bytes, not extension. */
export function detectFormat(bytes: Uint8Array): DetectedFormat {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png'
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpeg'
  if (startsWith(bytes, GB7_SIGNATURE)) return 'gb7'
  return 'unknown'
}
