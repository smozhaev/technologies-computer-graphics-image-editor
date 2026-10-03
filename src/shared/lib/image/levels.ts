import { createRaster, type RasterImage } from './image'

/** Input levels in level units (0..levelMax). */
export interface LevelsParams {
  black: number
  gamma: number
  white: number
}

export type LevelsChannel = 'master' | 'r' | 'g' | 'b' | 'a'
export type LevelsSettings = Record<LevelsChannel, LevelsParams>

/** Composed byte → byte tables per RGBA channel. */
export interface LevelsLuts {
  r: Uint8Array
  g: Uint8Array
  b: Uint8Array
  a: Uint8Array
}

export const GAMMA_MIN = 0.1
export const GAMMA_MAX = 9.9

export function identityParams(levelMax: number): LevelsParams {
  return { black: 0, gamma: 1, white: levelMax }
}

export function identitySettings(levelMax: number): LevelsSettings {
  const p = identityParams(levelMax)
  return { master: p, r: p, g: p, b: p, a: p }
}

export function isIdentity(p: LevelsParams, levelMax: number): boolean {
  return p.black === 0 && p.white === levelMax && p.gamma === 1
}

export function clampGamma(g: number): number {
  return Math.min(GAMMA_MAX, Math.max(GAMMA_MIN, g))
}

/** Midtone handle position (level units) for a gamma: black + (white − black)·0.5^γ. */
export function gammaToPosition(p: LevelsParams): number {
  return p.black + (p.white - p.black) * 0.5 ** p.gamma
}

/** Inverse of gammaToPosition, clamped to 0.1–9.9. */
export function positionToGamma(pos: number, black: number, white: number): number {
  const t = (pos - black) / (white - black)
  if (!(t > 0)) return GAMMA_MAX
  if (t >= 1) return GAMMA_MIN
  return clampGamma(Math.log(t) / Math.log(0.5))
}

/**
 * Byte → byte table: t = clamp((v − black)/(white − black)), out = t^(1/γ).
 * levelMax 127 re-quantises to the GB7 grid so content stays 7-bit.
 */
export function buildLut(p: LevelsParams, levelMax: 127 | 255): Uint8Array {
  const lut = new Uint8Array(256)
  const span = Math.max(1e-9, p.white - p.black)
  const inv = 1 / p.gamma
  for (let v = 0; v < 256; v++) {
    const level = (v * levelMax) / 255
    const t = Math.min(1, Math.max(0, (level - p.black) / span))
    const outLevel = Math.round(t ** inv * levelMax)
    lut[v] = levelMax === 255 ? outLevel : Math.round((outLevel * 255) / 127)
  }
  return lut
}

/** Per-channel tables first, then master on colour channels. Null when everything is identity. */
export function buildLevelsLuts(s: LevelsSettings, levelMax: 127 | 255): LevelsLuts | null {
  const all: LevelsChannel[] = ['master', 'r', 'g', 'b', 'a']
  if (all.every((c) => isIdentity(s[c], levelMax))) return null
  const master = buildLut(s.master, levelMax)
  const compose = (c: 'r' | 'g' | 'b') => {
    const ch = buildLut(s[c], levelMax)
    return ch.map((v) => master[v]!)
  }
  return { r: compose('r'), g: compose('g'), b: compose('b'), a: buildLut(s.a, levelMax) }
}

/** New raster with tables applied; input untouched. */
export function applyLevels(image: RasterImage, luts: LevelsLuts): RasterImage {
  const out = createRaster(image.width, image.height)
  const s = image.data
  const d = out.data
  for (let i = 0; i < s.length; i += 4) {
    d[i] = luts.r[s[i]!]!
    d[i + 1] = luts.g[s[i + 1]!]!
    d[i + 2] = luts.b[s[i + 2]!]!
    d[i + 3] = luts.a[s[i + 3]!]!
  }
  return out
}

export type LevelsHandle = 'black' | 'gamma' | 'white'

export const LEVELS_MIN_GAP = 2

/** Keeps black + gap ≤ white inside 0..max (integers); gamma clamped to 0.1–9.9. */
export function constrainLevels(
  next: LevelsParams,
  max: number,
  moved: LevelsHandle,
): LevelsParams {
  let black = Math.round(Math.min(Math.max(next.black, 0), max - LEVELS_MIN_GAP))
  let white = Math.round(Math.min(Math.max(next.white, LEVELS_MIN_GAP), max))
  if (white - black < LEVELS_MIN_GAP) {
    if (moved === 'white') white = black + LEVELS_MIN_GAP
    else black = white - LEVELS_MIN_GAP
  }
  return { black, white, gamma: clampGamma(next.gamma) }
}
