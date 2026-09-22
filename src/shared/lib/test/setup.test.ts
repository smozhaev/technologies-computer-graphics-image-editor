import { describe, expect, it, vi } from 'vitest'

describe('jsdom setup', () => {
  it('dialog showModal sets open, close dispatches close', () => {
    const dialog = document.createElement('dialog')
    const onClose = vi.fn()
    dialog.addEventListener('close', onClose)
    dialog.showModal()
    expect(dialog.open).toBe(true)
    dialog.close()
    expect(dialog.open).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('canvas 2d context stub and ImageData global', () => {
    const ctx = document.createElement('canvas').getContext('2d')
    expect(ctx?.putImageData).toBeTypeOf('function')
    const data = new ImageData(2, 2)
    expect(data.data.length).toBe(16)
  })

  it('URL.createObjectURL returns a string', () => {
    expect(typeof URL.createObjectURL(new Blob())).toBe('string')
  })
})
