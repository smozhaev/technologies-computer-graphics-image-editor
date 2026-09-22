// Test-only builders for minimal PNG/JPEG headers. CRCs are zero: parsers do not check them.

function u32(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
}

function chunk(type: string, data: number[] | Uint8Array): number[] {
  return [...u32(data.length), ...Array.from(type, (c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]
}

export function buildPng(o: {
  width: number
  height: number
  bitDepth: number
  colorType: number
  chunks?: { type: string; data: number[] }[]
  ihdrLength?: number
  firstType?: string
  noEnd?: boolean
}): Uint8Array<ArrayBuffer> {
  const ihdr = [...u32(o.width), ...u32(o.height), o.bitDepth, o.colorType, 0, 0, 0]
  const head = [
    ...u32(o.ihdrLength ?? 13),
    ...Array.from(o.firstType ?? 'IHDR', (c) => c.charCodeAt(0)),
    ...ihdr,
    0,
    0,
    0,
    0,
  ]
  const rest = (o.chunks ?? []).flatMap((c) => chunk(c.type, c.data))
  const end = o.noEnd ? [] : chunk('IEND', [])
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...head, ...rest, ...end])
}

export function segment(marker: number, payload: number[]): number[] {
  const len = payload.length + 2
  return [0xff, marker, len >> 8, len & 255, ...payload]
}

export function sof(
  marker: number,
  precision: number,
  height: number,
  width: number,
  components: number,
): number[] {
  const comps = Array.from({ length: components }, (_, k) => [k + 1, 0x11, 0]).flat()
  return segment(marker, [
    precision,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    components,
    ...comps,
  ])
}

export function buildJpeg(...segments: number[][]): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0xff, 0xd8, ...segments.flat()])
}
