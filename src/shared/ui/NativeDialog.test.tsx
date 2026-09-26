import { Select } from '@mantine/core'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/shared/lib/test'
import { useDialogPortalTarget } from './DialogPortalContext'
import { NativeDialog } from './NativeDialog'

afterEach(() => vi.restoreAllMocks())

const dialogEl = (c: HTMLElement) => c.querySelector('dialog')!

describe('NativeDialog', () => {
  it('showModal once under StrictMode; no open attribute when closed', () => {
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const { container, rerender } = renderWithProviders(
      <StrictMode>
        <NativeDialog opened={false} onClose={() => {}} title="T">
          x
        </NativeDialog>
      </StrictMode>,
    )
    expect(dialogEl(container).hasAttribute('open')).toBe(false)
    rerender(
      <StrictMode>
        <NativeDialog opened onClose={() => {}} title="T">
          x
        </NativeDialog>
      </StrictMode>,
    )
    expect(show).toHaveBeenCalledTimes(1)
    expect(dialogEl(container).open).toBe(true)
  })

  it('cancel → preventDefault + onClose; stays open', () => {
    const onClose = vi.fn()
    const { container } = renderWithProviders(
      <NativeDialog opened onClose={onClose} title="T">
        x
      </NativeDialog>,
    )
    const ev = new Event('cancel', { cancelable: true })
    fireEvent(dialogEl(container), ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(dialogEl(container).open).toBe(true)
  })

  it('native close while opened → onClose; parent close does not call it', () => {
    const onClose = vi.fn()
    const { container, rerender } = renderWithProviders(
      <NativeDialog opened onClose={onClose} title="T">
        x
      </NativeDialog>,
    )
    act(() => dialogEl(container).close())
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => dialogEl(container).showModal())
    rerender(
      <NativeDialog opened={false} onClose={onClose} title="T">
        x
      </NativeDialog>,
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('unmount while open closes without onClose', async () => {
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close')
    const onClose = vi.fn()
    const { unmount } = renderWithProviders(
      <NativeDialog opened onClose={onClose} title="T">
        x
      </NativeDialog>,
    )
    unmount()
    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })

  it.each([
    [true, 'dialog', 'dialog', 1],
    [true, 'inner', 'dialog', 0],
    [true, 'inner', 'inner', 0],
    [false, 'dialog', 'dialog', 0],
  ] as const)('backdrop closeOnBackdrop=%s down=%s click=%s → %i', (flag, down, click, calls) => {
    const onClose = vi.fn()
    renderWithProviders(
      <NativeDialog opened onClose={onClose} title="T" closeOnBackdrop={flag}>
        <span>inner</span>
      </NativeDialog>,
    )
    const d = document.querySelector('dialog')!
    const inner = screen.getByText('inner')
    fireEvent.pointerDown(down === 'dialog' ? d : inner)
    fireEvent.click(click === 'dialog' ? d : inner)
    expect(onClose).toHaveBeenCalledTimes(calls)
  })

  it('focus returns to opener', () => {
    function Harness({ opened }: { opened: boolean }) {
      return (
        <>
          <button>opener</button>
          <NativeDialog opened={opened} onClose={() => {}} title="T">
            <input aria-label="field" />
          </NativeDialog>
        </>
      )
    }
    const { rerender } = renderWithProviders(<Harness opened={false} />)
    screen.getByText('opener').focus()
    rerender(<Harness opened />)
    screen.getByLabelText('field').focus()
    rerender(<Harness opened={false} />)
    expect(document.activeElement).toBe(screen.getByText('opener'))
  })

  it('Mantine Select dropdown renders inside dialog and is clickable', async () => {
    function Inner() {
      const target = useDialogPortalTarget()
      const [v, setV] = useState<string | null>('a')
      return (
        <Select
          aria-label="sel"
          data={['a', 'b']}
          value={v}
          onChange={setV}
          comboboxProps={target ? { portalProps: { target } } : {}}
        />
      )
    }
    const selectInput = () =>
      screen.getAllByLabelText('sel').find((e) => e.tagName === 'INPUT') as HTMLInputElement
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(
      <NativeDialog opened onClose={() => {}} title="T">
        <Inner />
      </NativeDialog>,
    )
    await user.click(selectInput())
    const option = await screen.findByRole('option', { name: 'b' })
    expect(document.querySelector('dialog')!.contains(option)).toBe(true)
    await user.click(option)
    expect(selectInput()).toHaveValue('b')
  })
})
