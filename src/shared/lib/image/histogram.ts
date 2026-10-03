import { luma } from './color/luma'
import type { RasterImage } from './image'

export type HistogramChannel = 'luma' | 'r' | 'g' | 'b' | 'a'

const OFFSET: Record<Exclude<HistogramChannel, 'luma'>, number> = { r: 0, g: 1, b: 2, a: 3 }

/** Pixel counts per level 0..levelMax. Composite ('luma') uses BT.601; levelMax 127 bins bytes by round(v·127/255). */
export function histogram(
  image: RasterImage,
  channel: HistogramChannel,
  levelMax: 127 | 255,
): Uint32Array {
  const bins = new Uint32Array(levelMax + 1)
  const d = image.data
  const scale = levelMax / 255
  const toBin = new Uint8Array(256)
  for (let v = 0; v < 256; v++) toBin[v] = Math.round(v * scale)
  if (channel === 'luma') {
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.round(luma(d[i]!, d[i + 1]!, d[i + 2]!))
      bins[toBin[y]!]!++
    }
  } else {
    const off = OFFSET[channel]
    for (let i = off; i < d.length; i += 4) bins[toBin[d[i]!]!]!++
  }
  return bins
}
