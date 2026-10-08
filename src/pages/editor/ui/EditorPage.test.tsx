import { notifications } from '@mantine/notifications'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorPage } from './EditorPage'
import * as actions from '@/features/open-file/model/open-file'
import { editorStore, resetEditorStore, setDialog } from '@/entities/editor'
import { gb7File } from '@/shared/lib/test'
import { renderWithProviders } from '@/shared/lib/test'

vi.mock('@/shared/lib/io/decode-browser', () => ({ decodeWithBrowser: vi.fn() }))

beforeEach(() => {
  resetEditorStore()
  notifications.clean()
  vi.restoreAllMocks()
})

const input = () => screen.getByTestId('open-file-input') as HTMLInputElement
const status = () => screen.getByRole('status')
const pick = (file: File) => fireEvent.change(input(), { target: { files: [file] } })

describe('shell', () => {
  it('renders menus, tool, panels, empty status', () => {
    renderWithProviders(<EditorPage />)
    for (const name of ['Файл', 'Изображение', 'Фильтр'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Указатель (V)' })).toBeInTheDocument()
    expect(screen.getAllByText('Нет изображения')).toHaveLength(2)
    expect(status()).toHaveTextContent('Откройте изображение (Ctrl+O)')
  })

  it('file menu items enabled by document; future items disabled', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EditorPage />)
    await user.click(screen.getByRole('button', { name: 'Файл' }))
    expect(screen.getByRole('menuitem', { name: /Открыть/ })).toBeEnabled()
    expect(screen.getByRole('menuitem', { name: /Сохранить как/ })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Изображение' }))
    expect(screen.getByRole('menuitem', { name: /Уровни/ })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /Размер изображения/ })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /Отменить/ })).toBeDisabled()
  })

  it('opens GB7 via input, updates status and info; save/close work', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EditorPage />)
    expect(input()).toHaveAttribute('accept', '.png,.jpg,.jpeg,.gb7')
    pick(gb7File(3, 2, 0, 'pic.gb7'))
    await waitFor(() => expect(status()).toHaveTextContent('3 × 2 px · 7 бит · GB7'))
    expect(input().value).toBe('')
    expect(screen.getByText('Файл: pic.gb7')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Файл' }))
    await user.click(screen.getByRole('menuitem', { name: /Сохранить как/ }))
    expect(editorStore.getState().dialog).toBe('save')
    editorStore.setState((s) => setDialog(s, null))
    await user.click(screen.getByRole('button', { name: 'Файл' }))
    await user.click(screen.getByRole('menuitem', { name: 'Закрыть' }))
    expect(status()).toHaveTextContent('Откройте изображение')
  })

  it('masked GB7 status', async () => {
    renderWithProviders(<EditorPage />)
    pick(gb7File(2, 2, 1))
    await waitFor(() => expect(status()).toHaveTextContent('8 бит (7 + маска)'))
  })

  it('invalid file shows error, keeps previous', async () => {
    renderWithProviders(<EditorPage />)
    pick(gb7File(3, 2))
    await waitFor(() => expect(status()).toHaveTextContent('GB7'))
    pick(new File(['hello'], 'bad.png'))
    expect(await screen.findByText('Не удалось открыть файл')).toBeInTheDocument()
    expect(status()).toHaveTextContent('3 × 2 px · 7 бит · GB7')
  })

  it('warning notification', async () => {
    vi.spyOn(actions, 'openFile').mockResolvedValue({ status: 'opened', warning: 'Очень большое' })
    renderWithProviders(<EditorPage />)
    pick(gb7File(1, 1))
    expect(await screen.findByText('Очень большое')).toBeInTheDocument()
  })
})

describe('drop and hotkeys', () => {
  function dropEvent(type: string, files: File[]) {
    const e = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'dataTransfer', {
      value: { files, types: ['Files'], dropEffect: 'none' },
    })
    return e
  }

  it('window dragover/drop prevented; first file opened', () => {
    const spy = vi.spyOn(actions, 'openFile').mockResolvedValue({ status: 'stale' })
    renderWithProviders(<EditorPage />)
    const over = dropEvent('dragover', [])
    window.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    const a = gb7File(1, 1, 0, 'a.gb7')
    const drop = dropEvent('drop', [a, gb7File(1, 1, 0, 'b.gb7')])
    window.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(a)
    window.dispatchEvent(dropEvent('drop', []))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+O opens picker unless a dialog is open; Ctrl+S needs a document', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    renderWithProviders(<EditorPage />)
    const key = (k: string, shift = false) =>
      fireEvent.keyDown(document.documentElement, {
        key: k,
        code: `Key${k.toUpperCase()}`,
        ctrlKey: true,
        shiftKey: shift,
      })
    key('o')
    expect(click).toHaveBeenCalledTimes(1)
    key('s')
    expect(editorStore.getState().dialog).toBeNull()
    pick(gb7File(1, 1))
    await waitFor(() => expect(editorStore.getState().doc).not.toBeNull())
    key('s', true)
    expect(editorStore.getState().dialog).toBe('save')
    key('o')
    expect(click).toHaveBeenCalledTimes(1)
    editorStore.setState((s) => setDialog(s, null))
    key('s')
    expect(editorStore.getState().dialog).toBe('save')
    expect(within(document.body).queryByText('x')).toBeNull()
  })
})

describe('drop overlay and empty canvas', () => {
  it('overlay while files are dragged; empty canvas opens the picker', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    renderWithProviders(<EditorPage />)
    const enter = new Event('dragenter', { bubbles: true })
    Object.defineProperty(enter, 'dataTransfer', { value: { types: ['Files'], files: [] } })
    act(() => {
      window.dispatchEvent(enter)
    })
    expect(screen.getByTestId('drop-overlay')).toHaveTextContent('Отпустите, чтобы открыть')
    const leave = new Event('dragleave', { bubbles: true })
    Object.defineProperty(leave, 'dataTransfer', { value: { types: ['Files'], files: [] } })
    act(() => {
      window.dispatchEvent(leave)
    })
    expect(screen.queryByTestId('drop-overlay')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Открыть изображение/ }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('status bar shows file name and zoom', async () => {
    renderWithProviders(<EditorPage />)
    pick(gb7File(3, 2, 0, 'pic.gb7'))
    await waitFor(() => expect(status()).toHaveTextContent('pic.gb7'))
    expect(status()).toHaveTextContent(/%$/)
  })
})

describe('toolbar actions', () => {
  it('filter button opens the convolution dialog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EditorPage />)
    expect(screen.getByRole('button', { name: /Свёртка 3×3/ })).toBeDisabled()
    pick(gb7File(2, 2))
    await waitFor(() => expect(editorStore.getState().doc).not.toBeNull())
    await user.click(screen.getByRole('button', { name: /Свёртка 3×3/ }))
    expect(editorStore.getState().dialog).toBe('filter')
  })
})
