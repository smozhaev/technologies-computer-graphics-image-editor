export type SaveExtension = 'png' | 'jpg' | 'gb7'

export class FileNameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileNameError'
  }
}

const KNOWN_EXT = /\.(png|jpe?g|gb7)$/i

/** Strip path/reserved/control chars, trim, replace a known image extension, append `.ext`. */
export function sanitizeFileName(name: string, ext: SaveExtension): string {
  // eslint-disable-next-line no-control-regex
  let base = name.replace(/[/\\:*?"<>|\u0000-\u001f]/g, '').trim()
  base = base.replace(/[.\s]+$/, '')
  base = base
    .replace(KNOWN_EXT, '')
    .replace(/[.\s]+$/, '')
    .trim()
  if (!base) throw new FileNameError('Введите имя файла')
  return `${base}.${ext}`
}
