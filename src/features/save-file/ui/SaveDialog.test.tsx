import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRaster, type SourceInfo } from '@/shared/lib/image'
import { saveAs, SaveError } from '../model/save'
import { createDocument } from '@/entities/document'
import { editorStore, resetEditorStore, setDialog, setDocument } from '@/entities/editor'
import { renderWithProviders } from '@/shared/lib/test'
import { hexToRgb, stripExtension } from '../lib/save-form'
import { SaveDialog } from './SaveDialog'

vi.mock('../model/save', async (orig) => ({
  ...(await orig<typeof import('../model/save')>()),
  saveAs: vi.fn(async () => {}),
}))
const save = vi.mocked(saveAs)

function open(source: Partial<SourceInfo> = {}) {
  const doc = createDocument(
    {
      format: 'png',
      fileName: 'photo.png',
      bitDepth: 32,
      depthLabel: '',
      sourceWidth: 2,
      sourceHeight: 2,
      gb7HasMask: false,
      ...source,
    },
    { image: createRaster(2, 2), layout: 'rgba', levelMax: 255 },
  )
  act(() => editorStore.setState((s) => setDialog(setDocument(s, doc), 'save')))
}

const dialog = () => document.querySelector('dialog')!
const nameInput = () => screen.getByLabelText('Имя файла') as HTMLInputElement

beforeEach(() => {
  resetEditorStore()
  save.mockReset()
  save.mockResolvedValue(undefined)
})

describe('save-form helpers', () => {
  it('stripExtension and hexToRgb', () => {
    expect(['photo.png', 'a.b.gb7', 'noext'].map(stripExtension)).toEqual(['photo', 'a.b', 'noext'])
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#fa0')).toEqual({ r: 255, g: 170, b: 0 })
    expect(hexToRgb('zzz')).toEqual({ r: 255, g: 255, b: 255 })
  })
})

describe('SaveDialog', () => {
  it('fields depend on format; name default; mask default', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<SaveDialog />)
    open()
    expect(nameInput().value).toBe('photo')
    expect(screen.queryByLabelText('Качество')).toBeNull()
    await user.click(screen.getByText('JPG'))
    expect(screen.getByLabelText('Качество')).toHaveValue('92')
    expect(screen.getByLabelText('Фон для прозрачных пикселей')).toHaveValue('#ffffff')
    await user.click(screen.getByText('GB7'))
    expect(
      screen.getByText('Изображение будет сохранено в оттенках серого (7 бит)'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Качество')).toBeNull()
    expect(
      screen.getAllByLabelText('Маска прозрачности').find((e) => e.tagName === 'INPUT'),
    ).toHaveValue('Авто')
  })

  it('mask defaults to Всегда for masked GB7 source; GB7 is the default format', () => {
    renderWithProviders(<SaveDialog />)
    open({ format: 'gb7', fileName: 'k.gb7', gb7HasMask: true })
    expect(
      screen.getAllByLabelText('Маска прозрачности').find((e) => e.tagName === 'INPUT'),
    ).toHaveValue('Всегда')
  })

  it('empty name blocks submit', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SaveDialog />)
    open()
    await user.clear(nameInput())
    await user.type(nameInput(), '   ')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(screen.getByText('Введите имя файла')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('submits format-specific options', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<SaveDialog />)
    open()
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(save).toHaveBeenLastCalledWith({ format: 'png', name: 'photo' })

    await user.click(screen.getByText('JPG'))
    await user.clear(nameInput())
    await user.type(nameInput(), 'out')
    const q = screen.getByLabelText('Качество')
    await user.clear(q)
    await user.type(q, '80')
    const bg = screen.getByLabelText('Фон для прозрачных пикселей')
    await user.clear(bg)
    await user.type(bg, '#000000')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(save).toHaveBeenLastCalledWith({
      format: 'jpeg',
      name: 'out',
      quality: 80,
      background: { r: 0, g: 0, b: 0 },
    })

    await user.click(screen.getByText('GB7'))
    const maskInput = screen
      .getAllByLabelText('Маска прозрачности')
      .find((e) => e.tagName === 'INPUT')!
    await user.click(maskInput)
    const option = await screen.findByRole('option', { name: 'Без маски' })
    expect(dialog().contains(option)).toBe(true)
    await user.click(option)
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(save).toHaveBeenLastCalledWith({ format: 'gb7', name: 'out', mask: 'never' })
  })

  it('save error shown inline, dialog stays open; reopen clears it', async () => {
    save.mockRejectedValueOnce(new SaveError('Не удалось закодировать изображение'))
    const user = userEvent.setup()
    renderWithProviders(<SaveDialog />)
    open()
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    const alert = await screen.findByText('Не удалось закодировать изображение')
    expect(within(dialog()).getByText('Не удалось сохранить')).toBeInTheDocument()
    expect(dialog().contains(alert)).toBe(true)
    expect(dialog().open).toBe(true)
    act(() => editorStore.setState((s) => setDialog(s, null)))
    act(() => editorStore.setState((s) => setDialog(s, 'save')))
    expect(screen.queryByText('Не удалось закодировать изображение')).toBeNull()
  })

  it('cancel closes without saving; button disabled while pending', async () => {
    let finish!: () => void
    save.mockReturnValueOnce(new Promise<void>((r) => (finish = r)))
    const user = userEvent.setup()
    renderWithProviders(<SaveDialog />)
    open()
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    finish()
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(editorStore.getState().dialog).toBeNull()
    expect(save).toHaveBeenCalledTimes(1)
  })
})
