import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRaster, type ChannelLayout } from '@/shared/lib/image'
import { createDocument } from '@/entities/document'
import { editorStore, resetEditorStore, setDialog, setDocument } from '@/entities/editor'
import { renderWithProviders } from '@/shared/lib/test'
import { createInProcessRunner, setRunnerForTests, type JobRunner } from '@/shared/lib/worker'
import { FilterDialog } from './FilterDialog'

function open(layout: ChannelLayout = 'rgb') {
  const img = createRaster(3, 3)
  for (let i = 0; i < 9; i++) img.data.set([i === 4 ? 180 : 0, 0, 0, 255], i * 4)
  const doc = createDocument(
    {
      format: 'png',
      fileName: 'a',
      bitDepth: 24,
      depthLabel: '',
      sourceWidth: 3,
      sourceHeight: 3,
      gb7HasMask: false,
    },
    { image: img, layout, levelMax: 255 },
  )
  act(() => editorStore.setState((s) => setDialog(setDocument(s, doc), 'filter')))
}
const field = (label: string) =>
  screen.getAllByLabelText(label).find((e) => e.tagName === 'INPUT') as HTMLInputElement
const weights = () =>
  Array.from({ length: 9 }, (_, i) => field(`Вес ${Math.floor(i / 3) + 1}.${(i % 3) + 1}`).value)

beforeEach(() => {
  resetEditorStore()
  setRunnerForTests(createInProcessRunner())
})
afterEach(() => setRunnerForTests(null))

async function pick(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(field(label))
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('FilterDialog', () => {
  it('identity by default; preset fills grid and divisor; editing → Своё', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<FilterDialog />)
    open()
    expect(weights()).toEqual(['0', '0', '0', '0', '1', '0', '0', '0', '0'])
    await pick(user, 'Пресет', 'Фильтр Гаусса 3×3')
    expect(weights()).toEqual(['1', '2', '1', '2', '4', '2', '1', '2', '1'])
    expect(field('Делитель')).toHaveValue('16')
    await user.clear(field('Вес 1.1'))
    await user.type(field('Вес 1.1'), '3')
    expect(field('Пресет')).toHaveValue('Своё')
  })

  it('preview runs in the runner and updates the canvas source; preview off clears', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<FilterDialog />)
    open()
    await pick(user, 'Пресет', 'Фильтр Гаусса 3×3')
    await waitFor(() => expect(editorStore.getState().filterPreview?.data[16]).toBe(45)) // 180·4/16
    await user.click(screen.getByLabelText('Предпросмотр'))
    expect(editorStore.getState().filterPreview).toBeNull()
  })

  it('channels and padding controls; gray layout shows «Серый»', async () => {
    renderWithProviders(<FilterDialog />)
    open('gray-alpha')
    expect(screen.getByLabelText('Серый')).toBeChecked()
    expect(screen.getByLabelText('Альфа')).not.toBeChecked()
    expect(field('Края')).toHaveValue('Копировать крайние пиксели')
  })

  it('Apply pushes «Фильтр»; Reset and Close', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<FilterDialog />)
    open()
    await pick(user, 'Пресет', 'Прямоугольное размытие')
    await user.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(field('Пресет')).toHaveValue('Тождественное')
    await pick(user, 'Пресет', 'Прямоугольное размытие')
    await pick(user, 'Края', 'Заполнить чёрным')
    await user.click(screen.getByRole('button', { name: 'Применить' }))
    await waitFor(() => expect(editorStore.getState().doc?.versions).toHaveLength(2))
    const v = editorStore.getState().doc!.versions[1]!
    expect(v.label).toBe('Фильтр')
    expect(v.image.data[16]).toBe(20) // 180/9
    expect(v.image.data[0]).toBe(20)
    expect(editorStore.getState().dialog).toBeNull()
    expect(editorStore.getState().filterPreview).toBeNull()
  })
  it('Apply right after editing a field is not lost (preview debounce race)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<FilterDialog />)
    open()
    await pick(user, 'Пресет', 'Прямоугольное размытие')
    await user.clear(field('Смещение'))
    await user.type(field('Смещение'), '10')
    await user.click(screen.getByRole('button', { name: 'Применить' }))
    await waitFor(() => expect(editorStore.getState().doc?.versions).toHaveLength(2))
    expect(editorStore.getState().doc!.versions[1]!.image.data[16]).toBe(30) // 180/9 + 10
  })
  it('Σ sets the divisor to the kernel sum', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<FilterDialog />)
    open()
    await pick(user, 'Пресет', 'Фильтр Гаусса 3×3')
    await user.clear(field('Делитель'))
    await user.type(field('Делитель'), '1')
    await user.click(screen.getByRole('button', { name: 'Σ' }))
    expect(field('Делитель')).toHaveValue('16')
  })

  it('returning to an already previewed kernel mid-computation clears the spinner', async () => {
    const real = createInProcessRunner()
    let calls = 0
    let release: (() => void) | null = null
    const runner: JobRunner = {
      convolve: (src, params, lane) =>
        calls++ === 0
          ? real.convolve(src, params, lane)
          : new Promise((resolve) => {
              release = () => void real.convolve(src, params, lane).then(resolve)
            }),
      resize: (src, params) => real.resize(src, params),
    }
    setRunnerForTests(runner)
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<FilterDialog />)
    open()
    await waitFor(() => expect(editorStore.getState().filterPreview).not.toBeNull())
    await waitFor(() => expect(screen.queryByLabelText('Вычисление')).toBeNull())
    await user.clear(field('Вес 2.2'))
    await user.type(field('Вес 2.2'), '2')
    await waitFor(() => expect(release).not.toBeNull())
    expect(screen.getByLabelText('Вычисление')).toBeInTheDocument()
    await user.clear(field('Вес 2.2'))
    await user.type(field('Вес 2.2'), '1')
    act(() => release?.())
    await waitFor(() => expect(screen.queryByLabelText('Вычисление')).toBeNull())
  })
})
