/** Hand-built GB7 bytes for tests. */
export function makeGb7(
  w: number,
  h: number,
  pixels: number[],
  flags = 0,
): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    0x47,
    0x42,
    0x37,
    0x1d,
    1,
    flags,
    w >> 8,
    w & 255,
    h >> 8,
    h & 255,
    0,
    0,
    ...pixels,
  ])
}

export function gb7File(w: number, h: number, flags = 0, name = 'test.gb7'): File {
  return new File([makeGb7(w, h, new Array(w * h).fill(flags ? 0x80 | 40 : 40), flags)], name)
}
