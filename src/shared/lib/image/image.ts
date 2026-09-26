/** Plain RGBA raster used by every algorithm. data.length === width * height * 4. */
export interface RasterImage {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray<ArrayBuffer>
}

export type SourceFormat = 'png' | 'jpeg' | 'gb7'
export type ChannelLayout = 'gray' | 'gray-alpha' | 'rgb' | 'rgba'

/** Facts about the opened file. Never changes for the life of the document. */
export interface SourceInfo {
  format: SourceFormat
  fileName: string
  /** Bits per pixel as stored in the file: 24, 32, 8, 16, 48, 64, 7 (GB7), 8 (GB7 + mask). */
  bitDepth: number
  depthLabel: string
  sourceWidth: number
  sourceHeight: number
  gb7HasMask: boolean
}

/** One state of the pixels. Layout and level range are properties of the pixels. */
export interface ImageVersion {
  id: number
  label: string
  image: RasterImage
  layout: ChannelLayout
  levelMax: 127 | 255
}

export interface ImageDocument {
  source: SourceInfo
  versions: ImageVersion[]
  currentIndex: number
}

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0
}

/** Zero-filled raster backed by a new ArrayBuffer. */
export function createRaster(width: number, height: number): RasterImage {
  if (!isPositiveInt(width) || !isPositiveInt(height)) {
    throw new Error(`Некорректный размер изображения: ${width}×${height}`)
  }
  return { width, height, data: new Uint8ClampedArray(new ArrayBuffer(width * height * 4)) }
}

export function cloneRaster(img: RasterImage): RasterImage {
  return { width: img.width, height: img.height, data: img.data.slice() }
}

export function assertRaster(img: RasterImage): void {
  if (!isPositiveInt(img.width) || !isPositiveInt(img.height)) {
    throw new Error(`Некорректный размер изображения: ${img.width}×${img.height}`)
  }
  if (img.data.length !== img.width * img.height * 4) {
    throw new Error('Длина буфера не совпадает с размером изображения')
  }
}

export function hasTransparency(img: RasterImage): boolean {
  const d = img.data
  for (let i = 3; i < d.length; i += 4) {
    if (d[i]! < 255) return true
  }
  return false
}

/** Explicit rounding before writing to Uint8ClampedArray (which rounds half to even). */
export function toByte(v: number): number {
  if (Number.isNaN(v)) return 0
  const r = Math.round(v)
  return r < 0 ? 0 : r > 255 ? 255 : r
}

export function layoutHasAlpha(layout: ChannelLayout): boolean {
  return layout === 'gray-alpha' || layout === 'rgba'
}

export function isGrayLayout(layout: ChannelLayout): boolean {
  return layout === 'gray' || layout === 'gray-alpha'
}

export function layoutChannelCount(layout: ChannelLayout): 1 | 2 | 3 | 4 {
  switch (layout) {
    case 'gray':
      return 1
    case 'gray-alpha':
      return 2
    case 'rgb':
      return 3
    case 'rgba':
      return 4
  }
}
