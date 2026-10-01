import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDocument } from '@/entities/document'
import { editorStore, resetEditorStore, setDocument } from '@/entities/editor'
import { createRaster, type ChannelLayout } from '@/shared/lib/image'
import { renderWithProviders } from '@/shared/lib/test'
import { ChannelsPanel } from './ChannelsPanel'

function load(layout: ChannelLayout) {
  const image = createRaster(4, 4)
  image.data.fill(255)
  const doc = createDocument(
    {
      format: 'png',
      fileName: 'a',
      bitDepth: 24,
      depthLabel: '',
      sourceWidth: 4,
      sourceHeight: 4,
      gb7HasMask: false,
    },
    { image, layout, levelMax: 255 },
  )
  act(() => editorStore.setState((s) => setDocument(s, doc)))
}
const rows = () =>
  screen.getAllByRole('button', { name: /^Канал «/ }).map((b) => b.getAttribute('aria-label'))
const channels = () => editorStore.getState().channels

beforeEach(resetEditorStore)

describe('ChannelsPanel', () => {
  it.each([
    ['gray', ['Канал «Серый»']],
    ['gray-alpha', ['Канал «Серый»', 'Канал «Альфа»']],
    ['rgb', ['Канал «RGB»', 'Канал «Красный»', 'Канал «Зелёный»', 'Канал «Синий»']],
    [
      'rgba',
      ['Канал «RGB»', 'Канал «Красный»', 'Канал «Зелёный»', 'Канал «Синий»', 'Канал «Альфа»'],
    ],
  ] as const)('%s → rows (composite only for colour)', (layout, names) => {
    renderWithProviders(<ChannelsPanel />)
    load(layout)
    expect(rows()).toEqual(names)
  })

  it('eye toggles one channel; last visible channel cannot be hidden', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChannelsPanel />)
    load('rgb')
    await user.click(screen.getByRole('button', { name: 'Скрыть канал «Зелёный»' }))
    expect(channels().g).toBe(false)
    expect(screen.getByRole('button', { name: 'Канал «RGB»' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await user.click(screen.getByRole('button', { name: 'Скрыть канал «Красный»' }))
    await user.click(screen.getByRole('button', { name: 'Скрыть канал «Синий»' }))
    expect(channels().b).toBe(true)
  })

  it('click on a channel shows only it; composite row restores colour channels', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChannelsPanel />)
    load('rgba')
    await user.click(screen.getByRole('button', { name: 'Канал «Синий»' }))
    expect(channels()).toMatchObject({ r: false, g: false, b: true, a: false })
    await user.click(screen.getByRole('button', { name: 'Канал «RGB»' }))
    expect(channels()).toMatchObject({ r: true, g: true, b: true })
    expect(screen.getByRole('button', { name: 'Канал «RGB»' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('new document resets channels', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChannelsPanel />)
    load('rgb')
    await user.click(screen.getByRole('button', { name: 'Скрыть канал «Зелёный»' }))
    load('rgb')
    expect(channels().g).toBe(true)
  })
})
