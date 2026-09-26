import { describe, expect, it } from 'vitest'
import { FileNameError, sanitizeFileName } from './file-name'

describe('sanitizeFileName', () => {
  it.each([
    ['photo', 'png', 'photo.png'],
    ['a/b\\c:d*e?f"g<h>i|j', 'png', 'abcdefghij.png'],
    ['  pic . ', 'jpg', 'pic.jpg'],
    ['photo.png', 'jpg', 'photo.jpg'],
    ['x.JPEG', 'gb7', 'x.gb7'],
    ['a.jpg', 'jpg', 'a.jpg'],
    ['my.photo', 'png', 'my.photo.png'],
  ] as const)('%s + %s → %s', (name, ext, out) => {
    expect(sanitizeFileName(name, ext)).toBe(out)
  })
  it.each(['', '   ', '///', '.png'])('rejects %j', (name) => {
    expect(() => sanitizeFileName(name, 'png')).toThrow(FileNameError)
  })
})
