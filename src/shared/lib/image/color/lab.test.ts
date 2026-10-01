import { describe, expect, it } from 'vitest'
import { srgbToLab } from './lab'

describe('srgbToLab', () => {
  it.each([
    [255, 255, 255, 100, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [255, 0, 0, 53.2408, 80.0925, 67.2032],
    [0, 255, 0, 87.7347, -86.1827, 83.1793],
    [0, 0, 255, 32.297, 79.1875, -107.8602],
    [255, 255, 0, 97.1393, -21.5537, 94.478],
    [0, 255, 255, 91.1132, -48.0875, -14.1312],
    [255, 0, 255, 60.3242, 98.2343, -60.8249],
    [128, 128, 128, 53.585, 0, 0],
    [119, 119, 119, 50.0344, 0, 0],
    [1, 1, 1, 0.2742, 0, 0],
  ])('rgb(%i,%i,%i)', (r, g, b, L, a, bb) => {
    const lab = srgbToLab(r, g, b)
    expect(lab.L).toBeCloseTo(L, 3)
    expect(lab.a).toBeCloseTo(a, 3)
    expect(lab.b).toBeCloseTo(bb, 3)
  })
})
