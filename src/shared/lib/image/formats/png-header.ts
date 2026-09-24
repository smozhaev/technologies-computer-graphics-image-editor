import type { ChannelLayout } from '../image'
import { PNG_SIGNATURE, startsWith } from './detect'
import { formatDepthLabel, HeaderError, type DepthKind, type HeaderInfo } from './header-info'

const VALID_DEPTHS: Record<number, readonly number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
}

function u32(b: Uint8Array, p: number): number {
  return ((b[p]! << 24) | (b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!) >>> 0
}

function chunkType(b: Uint8Array, p: number): string {
  return String.fromCharCode(b[p]!, b[p + 1]!, b[p + 2]!, b[p + 3]!)
}

export function readPngHeader(bytes: Uint8Array): HeaderInfo {
  if (bytes.length < 33) throw new HeaderError('PNG: заголовок обрезан')
  if (!startsWith(bytes, PNG_SIGNATURE)) throw new HeaderError('PNG: неверная сигнатура')
  if (u32(bytes, 8) !== 13 || chunkType(bytes, 12) !== 'IHDR') {
    throw new HeaderError('PNG: первый блок не IHDR')
  }
  const width = u32(bytes, 16)
  const height = u32(bytes, 20)
  const depth = bytes[24]!
  const colorType = bytes[25]!
  if (width === 0 || height === 0) throw new HeaderError('PNG: нулевой размер')
  if (!VALID_DEPTHS[colorType]?.includes(depth)) {
    throw new HeaderError(`PNG: недопустимое сочетание типа цвета ${colorType} и глубины ${depth}`)
  }

  let trns = false
  let p = 33
  while (p + 8 <= bytes.length) {
    const len = u32(bytes, p)
    const type = chunkType(bytes, p + 4)
    if (type === 'IDAT' || type === 'IEND') break
    if (len > 0x7fffffff || p + 12 + len > bytes.length)
      throw new HeaderError('PNG: блок выходит за конец файла')
    if (type === 'tRNS') {
      trns = true
      break
    }
    p += 12 + len
  }

  let bitDepth: number
  let kind: DepthKind
  let layout: ChannelLayout
  switch (colorType) {
    case 0:
      bitDepth = depth
      kind = 'gray'
      layout = trns ? 'gray-alpha' : 'gray'
      break
    case 2:
      bitDepth = depth * 3
      kind = 'rgb'
      layout = trns ? 'rgba' : 'rgb'
      break
    case 3:
      bitDepth = depth
      kind = 'palette'
      layout = trns ? 'rgba' : 'rgb'
      break
    case 4:
      bitDepth = depth * 2
      kind = 'gray-alpha'
      layout = 'gray-alpha'
      trns = false
      break
    default:
      bitDepth = depth * 4
      kind = 'rgba'
      layout = 'rgba'
      trns = false
  }
  return { width, height, layout, bitDepth, depthLabel: formatDepthLabel(bitDepth, kind, { trns }) }
}
