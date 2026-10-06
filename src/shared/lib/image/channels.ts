import { type ChannelLayout, type RasterImage } from './image'
import { resample, type InterpolatorId } from './interpolation'

export type ChannelId = 'gray' | 'r' | 'g' | 'b' | 'a'
export type ChannelMask = Readonly<Record<ChannelId, boolean>>

export const ALL_CHANNELS_ON: ChannelMask = { gray: true, r: true, g: true, b: true, a: true }

const LAYOUT_CHANNELS: Record<ChannelLayout, readonly ChannelId[]> = {
  gray: ['gray'],
  'gray-alpha': ['gray', 'a'],
  rgb: ['r', 'g', 'b'],
  rgba: ['r', 'g', 'b', 'a'],
}

export const CHANNEL_LABEL: Record<ChannelId, string> = {
  gray: 'Серый',
  r: 'Красный',
  g: 'Зелёный',
  b: 'Синий',
  a: 'Альфа',
}

export function channelsForLayout(layout: ChannelLayout): readonly ChannelId[] {
  return LAYOUT_CHANNELS[layout]
}

/** Byte offset of a channel inside an RGBA pixel (grey is stored in R). */
function offsetOf(channel: ChannelId): number {
  return channel === 'a' ? 3 : channel === 'g' ? 1 : channel === 'b' ? 2 : 0
}

/** True when every channel of the layout is on (stage can be skipped). */
export function isMaskIdentity(mask: ChannelMask, layout: ChannelLayout): boolean {
  return channelsForLayout(layout).every((c) => mask[c])
}

/**
 * Display rule for one RGBA pixel, written into out[0..3]:
 * disabled colour channels → 0; alpha off → opaque; only alpha on → alpha as opaque grey; nothing on → black.
 */
export function maskPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  layout: ChannelLayout,
  mask: ChannelMask,
  out: Uint8ClampedArray | number[],
): void {
  const gray = layout === 'gray' || layout === 'gray-alpha'
  const hasAlpha = layout === 'gray-alpha' || layout === 'rgba'
  const alphaOn = hasAlpha && mask.a
  const colorOn = gray ? mask.gray : mask.r || mask.g || mask.b
  if (!colorOn) {
    const v = alphaOn ? a : 0
    out[0] = v
    out[1] = v
    out[2] = v
    out[3] = 255
    return
  }
  if (gray) {
    out[0] = r
    out[1] = g
    out[2] = b
  } else {
    out[0] = mask.r ? r : 0
    out[1] = mask.g ? g : 0
    out[2] = mask.b ? b : 0
  }
  out[3] = alphaOn ? a : 255
}

/** Greyscale thumbnail (white = max) of one channel, fit into maxW×maxH with own interpolation. */
export function channelThumbnail(
  image: RasterImage,
  channel: ChannelId,
  maxW: number,
  maxH: number,
  method: InterpolatorId = 'bilinear',
): RasterImage {
  const scale = Math.min(maxW / image.width, maxH / image.height, 1)
  const w = Math.max(1, Math.round(image.width * scale))
  const h = Math.max(1, Math.round(image.height * scale))
  const out = resample(image, w, h, method)
  const d = out.data
  const off = offsetOf(channel)
  for (let o = 0; o < d.length; o += 4) {
    const v = d[o + off]!
    d[o] = v
    d[o + 1] = v
    d[o + 2] = v
    d[o + 3] = 255
  }
  return out
}
