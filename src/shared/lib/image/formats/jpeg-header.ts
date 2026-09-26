import { formatDepthLabel, HeaderError, type HeaderInfo } from './header-info'

function isSof(m: number): boolean {
  return m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc
}

export function readJpegHeader(bytes: Uint8Array): HeaderInfo {
  const n = bytes.length
  if (n < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    throw new HeaderError('JPEG: неверная сигнатура')
  let i = 2
  for (;;) {
    if (i >= n) throw new HeaderError('JPEG: не найден маркер SOF')
    if (bytes[i] !== 0xff) throw new HeaderError('JPEG: ожидался маркер')
    while (i < n && bytes[i] === 0xff) i++
    if (i >= n) throw new HeaderError('JPEG: файл обрезан')
    const m = bytes[i]!
    i++
    if (m === 0x00) throw new HeaderError('JPEG: неожиданный байт после FF')
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01 || m === 0xd8) continue
    if (m === 0xda || m === 0xd9) throw new HeaderError('JPEG: не найден маркер SOF')
    if (i + 2 > n) throw new HeaderError('JPEG: файл обрезан')
    const len = (bytes[i]! << 8) | bytes[i + 1]!
    if (len < 2 || i + len > n) throw new HeaderError('JPEG: некорректная длина сегмента')
    if (isSof(m)) {
      if (len < 8) throw new HeaderError('JPEG: сегмент SOF слишком короткий')
      const precision = bytes[i + 2]!
      const height = (bytes[i + 3]! << 8) | bytes[i + 4]!
      const width = (bytes[i + 5]! << 8) | bytes[i + 6]!
      const nf = bytes[i + 7]!
      if (len < 8 + 3 * nf) throw new HeaderError('JPEG: сегмент SOF слишком короткий')
      if (nf !== 1 && nf !== 3 && nf !== 4)
        throw new HeaderError(`JPEG: неподдерживаемое число компонент ${nf}`)
      if (width === 0 || height === 0 || precision === 0)
        throw new HeaderError('JPEG: некорректный SOF')
      const bitDepth = precision * nf
      if (nf === 1)
        return {
          width,
          height,
          layout: 'gray',
          bitDepth,
          depthLabel: formatDepthLabel(bitDepth, 'gray'),
        }
      return {
        width,
        height,
        layout: 'rgb',
        bitDepth,
        depthLabel: formatDepthLabel(bitDepth, nf === 3 ? 'rgb' : 'cmyk'),
      }
    }
    i += len
  }
}
