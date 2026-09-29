import { describe, expect, it } from 'vitest'
import {
  ALL_CHANNELS_ON,
  channelsForLayout,
  channelThumbnail,
  isMaskIdentity,
  maskPixel,
  type ChannelMask,
} from './channels'
import { createRaster } from './image'

const mask = (o: Partial<ChannelMask>): ChannelMask => ({ ...ALL_CHANNELS_ON, ...o })
const run = (px: number[], layout: Parameters<typeof maskPixel>[4], m: ChannelMask) => {
  const out = [0, 0, 0, 0]
  maskPixel(px[0]!, px[1]!, px[2]!, px[3]!, layout, m, out)
  return out
}

describe('channels', () => {
  it('channelsForLayout', () => {
    expect(channelsForLayout('gray')).toEqual(['gray'])
    expect(channelsForLayout('gray-alpha')).toEqual(['gray', 'a'])
    expect(channelsForLayout('rgb')).toEqual(['r', 'g', 'b'])
    expect(channelsForLayout('rgba')).toEqual(['r', 'g', 'b', 'a'])
  })
  it('isMaskIdentity ignores channels outside the layout', () => {
    expect(isMaskIdentity(mask({ a: false }), 'rgb')).toBe(true)
    expect(isMaskIdentity(mask({ g: false }), 'rgb')).toBe(false)
  })
  it('green off zeroes green', () => {
    expect(run([10, 20, 30, 255], 'rgb', mask({ g: false }))).toEqual([10, 0, 30, 255])
  })
  it('only alpha on → alpha as opaque grey', () => {
    expect(run([10, 20, 30, 77], 'rgba', mask({ r: false, g: false, b: false }))).toEqual([
      77, 77, 77, 255,
    ])
    expect(run([50, 50, 50, 0], 'gray-alpha', mask({ gray: false }))).toEqual([0, 0, 0, 255])
  })
  it('alpha off → opaque with colour', () => {
    expect(run([10, 20, 30, 0], 'rgba', mask({ a: false }))).toEqual([10, 20, 30, 255])
  })
  it('gray off without alpha → black; all on keeps alpha', () => {
    expect(run([90, 90, 90, 255], 'gray', mask({ gray: false }))).toEqual([0, 0, 0, 255])
    expect(run([90, 90, 90, 40], 'gray-alpha', ALL_CHANNELS_ON)).toEqual([90, 90, 90, 40])
  })
  it('thumbnail: nearest, greyscale of channel, fits box, input unchanged', () => {
    const img = createRaster(4, 2)
    for (let i = 0; i < 8; i++) img.data.set([i * 10, 200, 0, i * 30], i * 4)
    const copy = img.data.slice()
    const t = channelThumbnail(img, 'r', 2, 2, 'nearest')
    expect([t.width, t.height]).toEqual([2, 1])
    expect(Array.from(t.data)).toEqual([50, 50, 50, 255, 70, 70, 70, 255])
    const bl = channelThumbnail(img, 'r', 2, 2)
    expect(bl.data[0]).toBeGreaterThan(0)
    const a = channelThumbnail(img, 'a', 10, 10, 'nearest')
    expect([a.width, a.height]).toEqual([4, 2])
    expect(a.data[4 * 7]).toBe(210)
    expect(img.data).toEqual(copy)
  })
})
