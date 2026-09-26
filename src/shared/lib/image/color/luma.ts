/** BT.601 luma: Y = 0.299R + 0.587G + 0.114B. Inputs 0..255, returns an unrounded float. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}
