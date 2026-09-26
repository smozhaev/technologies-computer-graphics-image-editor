import { describe, expect, it } from 'vitest'
import { createRaster } from '../image'
import { normalizeGray } from './normalize-gray'

describe('normalizeGray', () => {
  it('copies R into G and B, keeps alpha; input unchanged', () => {
    const img = createRaster(1, 1)
    img.data.set([100, 101, 99, 200])
    const copy = img.data.slice()
    const out = normalizeGray(img)
    expect(Array.from(out.data)).toEqual([100, 100, 100, 200])
    expect(out.data).not.toBe(img.data)
    expect(img.data).toEqual(copy)
  })
})
