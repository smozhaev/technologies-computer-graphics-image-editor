import { luma } from '../color/luma'
import { createRaster, type RasterImage } from '../image'
import { GB7_SIGNATURE, startsWith } from './detect'

// GrayBit-7: 12-byte header, then one byte per pixel.
// Bits 6–0 = grey 0..127, bit 7 = mask (1 visible) when header flag bit 0 is set.
// The assignment once says «бит 0» for the mask — a typo; the byte layout puts it in bit 7.

const HEADER = 12
const VERSION = 1
const MAX_PIXELS = 2 ** 28
const MAX_SIDE = 65535

export class Gb7Error extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Gb7Error'
  }
}

export interface Gb7DecodeResult {
  image: RasterImage
  hasMask: boolean
}

export type Gb7MaskMode = 'auto' | 'always' | 'never'

const GREY_TO_BYTE = Array.from({ length: 128 }, (_, v) => Math.round((v * 255) / 127))

export function decodeGb7(bytes: Uint8Array): Gb7DecodeResult {
  if (bytes.length < HEADER) throw new Gb7Error('Файл слишком короткий для GB7')
  if (!startsWith(bytes, GB7_SIGNATURE)) throw new Gb7Error('Неверная сигнатура GB7')
  if (bytes[4] !== VERSION) throw new Gb7Error(`Неподдерживаемая версия GB7: ${bytes[4]}`)

  const hasMask = (bytes[5]! & 1) === 1
  const width = (bytes[6]! << 8) | bytes[7]!
  const height = (bytes[8]! << 8) | bytes[9]!
  if (width === 0 || height === 0) throw new Gb7Error(`Некорректный размер GB7: ${width}×${height}`)

  const pixels = width * height
  if (pixels > MAX_PIXELS) throw new Gb7Error('Изображение слишком большое')
  const available = bytes.length - HEADER
  if (available < pixels) {
    throw new Gb7Error(`Файл обрезан: ожидалось ${pixels} байт пикселей, есть ${available}`)
  }

  let image: RasterImage
  try {
    image = createRaster(width, height)
  } catch (e) {
    if (e instanceof RangeError) throw new Gb7Error('Недостаточно памяти для изображения')
    throw e
  }

  const out = image.data
  for (let i = 0, o = 0; i < pixels; i++, o += 4) {
    const b = bytes[HEADER + i]!
    const v = GREY_TO_BYTE[b & 0x7f]!
    out[o] = v
    out[o + 1] = v
    out[o + 2] = v
    out[o + 3] = hasMask ? (b & 0x80 ? 255 : 0) : 255
  }
  return { image, hasMask }
}

export function encodeGb7(image: RasterImage, opts: { mask?: Gb7MaskMode } = {}): Uint8Array {
  const { width, height, data } = image
  if (width > MAX_SIDE || height > MAX_SIDE) {
    throw new Gb7Error(`GB7 поддерживает размер до ${MAX_SIDE} × ${MAX_SIDE}`)
  }
  const mode = opts.mask ?? 'auto'
  const pixels = width * height

  let withMask = mode === 'always'
  if (mode === 'auto') {
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 128) {
        withMask = true
        break
      }
    }
  }

  const out = new Uint8Array(HEADER + pixels)
  out.set(GB7_SIGNATURE, 0)
  out[4] = VERSION
  out[5] = withMask ? 1 : 0
  out[6] = width >> 8
  out[7] = width & 0xff
  out[8] = height >> 8
  out[9] = height & 0xff

  for (let i = 0, p = 0; i < pixels; i++, p += 4) {
    const grey = Math.round((luma(data[p]!, data[p + 1]!, data[p + 2]!) * 127) / 255)
    const visible = withMask && data[p + 3]! >= 128 ? 0x80 : 0
    out[HEADER + i] = grey | visible
  }
  return out
}
