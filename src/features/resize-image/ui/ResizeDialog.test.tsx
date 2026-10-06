import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createRaster } from '@/shared/lib/image'
import { createDocument } from '@/entities/document'
import { editorStore, resetEditorStore, setDialog, setDocument } from '@/entities/editor'
import { renderWithProviders } from '@/shared/lib/test'
import { ResizeDialog } from './ResizeDialog'

function open(w = 200, h = 100) {
  const doc = createDocument(
    {
      format: 'png',
      fileName: 'a',
      bitDepth: 24,
      depthLabel: '',
      sourceWidth: w,
      sourceHeight: h,
      gb7HasMask: false,
    },
    { image: createRaster(w, h), layout: 'rgb', levelMax: 255 },
  )
  act(() => editorStore.setState((s) => setDialog(setDocument(s, doc), 'resize')))
}
const field = (label: string) =>
  screen.getAllByLabelText(label).find((e) => e.tagName === 'INPUT') as HTMLInputElement

beforeEach(resetEditorStore)

describe('ResizeDialog', () => {
  it('shows MP before/after; aspect lock; units switch', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<ResizeDialog />)
    open()
    expect(screen.getByText(/Сейчас: 200 × 100 px · 0.02 МП/)).toBeInTheDocument()
    await user.clear(field('Ширина'))
    await user.type(field('Ширина'), '100')
    expect(field('Высота')).toHaveValue('50 px')
    expect(screen.getByLabelText('Новый размер')).toHaveTextContent('100 × 50 px · 0.01 МП')
    await user.click(field('Единицы'))
    await user.click(await screen.findByRole('option', { name: 'Проценты' }))
    expect(field('Ширина')).toHaveValue('50 %')
    await user.click(screen.getByLabelText('Сохранять пропорции'))
    await user.clear(field('Высота'))
    await user.type(field('Высота'), '200')
    expect(field('Ширина')).toHaveValue('50 %')
    expect(screen.getByLabelText('Новый размер')).toHaveTextContent('100 × 200 px')
  })

  it('validation disables Apply', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ResizeDialog />)
    open()
    await user.clear(field('Ширина'))
    expect(screen.getByText('Введите число')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Применить' })).toBeDisabled()
    await user.type(field('Ширина'), '99999')
    expect(screen.getAllByText(/От 1 до 16384/).length).toBeGreaterThan(0)
  })

  it('algorithm tooltip and Apply pushes a resized version', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<ResizeDialog />)
    open()
    await user.hover(screen.getByRole('button', { name: 'Об алгоритме' }))
    expect(await screen.findByText(/Взвешенное среднее/)).toBeInTheDocument()
    await user.clear(field('Ширина'))
    await user.type(field('Ширина'), '50')
    await user.click(screen.getByRole('button', { name: 'Применить' }))
    await waitFor(() => expect(editorStore.getState().doc!.versions).toHaveLength(2))
    const doc = editorStore.getState().doc!
    expect(doc.versions).toHaveLength(2)
    expect(doc.versions[1]!.label).toBe('Размер')
    expect([doc.versions[1]!.image.width, doc.versions[1]!.image.height]).toEqual([50, 25])
    expect(editorStore.getState().dialog).toBeNull()
  })
})
