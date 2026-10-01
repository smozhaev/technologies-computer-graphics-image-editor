export interface Lab {
  L: number
  a: number
  b: number
}

const XN = 0.95047
const YN = 1
const ZN = 1.08883
const EPS = 216 / 24389
const KAPPA = 24389 / 27

const LINEAR = Array.from({ length: 256 }, (_, c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
})

function f(t: number): number {
  return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116
}

/** sRGB 8-bit → CIELAB (D65, Lindbloom matrix). */
export function srgbToLab(r: number, g: number, b: number): Lab {
  const lr = LINEAR[r]!
  const lg = LINEAR[g]!
  const lb = LINEAR[b]!
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb
  const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb
  const fx = f(x / XN)
  const fy = f(y / YN)
  const fz = f(z / ZN)
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}
