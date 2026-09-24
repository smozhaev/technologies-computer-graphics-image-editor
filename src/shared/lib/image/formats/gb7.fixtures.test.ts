import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeGb7, encodeGb7 } from './gb7'

const dir = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../test-images')
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.gb7')) : []
const inCI = Boolean(process.env.CI)

describe('LMS GB7 fixtures', () => {
  it.runIf(files.length === 0)('fixtures present', () => {
    if (inCI) throw new Error(`Нет файлов .gb7 в ${dir}`)
    console.warn(`Пропуск: положите файлы LMS .gb7 в ${dir}`)
  })

  it.each(files)('%s decodes and round-trips', (name) => {
    const bytes = new Uint8Array(readFileSync(resolve(dir, name)))
    const { image, hasMask } = decodeGb7(bytes)
    const w = (bytes[6]! << 8) | bytes[7]!
    const h = (bytes[8]! << 8) | bytes[9]!
    expect([image.width, image.height]).toEqual([w, h])
    expect(hasMask).toBe(name.includes('-mask'))

    const n = 12 + w * h
    const back = encodeGb7(image, { mask: hasMask ? 'always' : 'never' })
    expect(Array.from(back.slice(0, 10))).toEqual(Array.from(bytes.slice(0, 10)))
    // canonical files compare whole bytes; non-canonical (bit7 set without flag) compare bits 6–0
    const canonical = hasMask || bytes.slice(12, n).every((b) => (b & 0x80) === 0)
    const keep = canonical ? 0xff : 0x7f
    let firstDiff = -1
    for (let i = 12; i < n; i++) {
      if ((back[i]! & keep) !== (bytes[i]! & keep)) {
        firstDiff = i
        break
      }
    }
    expect(firstDiff).toBe(-1)
  })
})
