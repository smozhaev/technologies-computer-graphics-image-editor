import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRaster, type ChannelLayout } from '@/shared/lib/image'
import { undoVersion } from '@/features/undo-version'
import { createDocument } from '@/entities/document'
import { editorStore, resetEditorStore, setDialog, setDocument } from '@/entities/editor'
import { renderWithProviders } from '@/shared/lib/test'
import { LevelsDialog } from './LevelsDialog'

let frames: FrameRequestCallback[] = []
const flush = () =>
  act(() => {
    const f = frames
    frames = []
    f.forEach((cb) => cb(0))
  })

function open(layout: ChannelLayout = 'rgb', levelMax: 127 | 255 = 255) {
  const img = createRaster(2, 1)
  img.data.set([64, 64, 64, 255, 200, 100, 50, 255])
  const doc = createDocument(
    {
      format: 'png',
      fileName: 'a',
      bitDepth: 24,
      depthLabel: '',
      sourceWidth: 2,
      sourceHeight: 1,
      gb7HasMask: false,
    },
    { image: img, layout, levelMax },
  )
  act(() => editorStore.setState((s) => setDialog(setDocument(s, doc), 'levels')))
}

const input = (label: string) =>
  screen.getAllByLabelText(label).find((e) => e.tagName === 'INPUT') as HTMLInputElement

beforeEach(() => {
  resetEditorStore()
  frames = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function setWhite(user: ReturnType<typeof userEvent.setup>, v: string) {
  const white = input('Белый')
  await user.clear(white)
  await user.type(white, v)
}

describe('LevelsDialog', () => {
  it('channel list by layout; GB7 axis max 127', () => {
    renderWithProviders(<LevelsDialog />)
    open('gray-alpha', 127)
    expect(input('Канал')).toHaveValue('Серый (все)')
    expect(input('Белый')).toHaveValue('127')
  })

  it('edits drive live preview; preview off restores; channel edits persist', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<LevelsDialog />)
    open()
    flush()
    expect(editorStore.getState().levelsPreview).toBeNull()
    await setWhite(user, '128')
    flush()
    expect(editorStore.getState().levelsPreview?.r[64]).toBe(128)

    await user.click(input('Канал'))
    await user.click(await screen.findByRole('option', { name: 'Красный' }))
    expect(input('Белый')).toHaveValue('255')
    await user.click(input('Канал'))
    await user.click(await screen.findByRole('option', { name: 'RGB (все)' }))
    expect(input('Белый')).toHaveValue('128')

    await user.click(screen.getByLabelText('Предпросмотр'))
    flush()
    expect(editorStore.getState().levelsPreview).toBeNull()
  })

  it('Reset keeps dialog open; Cancel discards', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LevelsDialog />)
    open()
    await setWhite(user, '100')
    await user.click(screen.getByRole('button', { name: 'Сброс' }))
    expect(input('Белый')).toHaveValue('255')
    expect(editorStore.getState().dialog).toBe('levels')
    await setWhite(user, '100')
    flush()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(editorStore.getState().dialog).toBeNull()
    expect(editorStore.getState().levelsPreview).toBeNull()
    expect(editorStore.getState().doc?.versions).toHaveLength(1)
  })

  it('Apply pushes a version; undo restores', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LevelsDialog />)
    open()
    await setWhite(user, '128')
    await user.click(screen.getByRole('button', { name: 'Применить' }))
    const doc = editorStore.getState().doc!
    expect(doc.versions).toHaveLength(2)
    expect(doc.versions[1]!.image.data[0]).toBe(128)
    expect(doc.versions[0]!.image.data[0]).toBe(64)
    expect(editorStore.getState().dialog).toBeNull()
    act(() => undoVersion())
    expect(editorStore.getState().doc?.currentIndex).toBe(0)
  })
})
