import { fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { LevelsParams } from '@/shared/lib/image'
import { renderWithProviders } from '@/shared/lib/test'
import { Histogram } from './Histogram'
import { LevelsSlider } from './LevelsSlider'
import { constrainLevels as constrain } from '@/shared/lib/image'

function Harness({
  initial,
  onChange,
}: {
  initial: LevelsParams
  onChange?: (p: LevelsParams) => void
}) {
  const [v, setV] = useState(initial)
  return (
    <LevelsSlider
      value={v}
      max={255}
      onChange={(p) => {
        setV(p)
        onChange?.(p)
      }}
    />
  )
}

function track(width = 255) {
  const el = document.querySelector('[data-handle]')!.parentElement!
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 0, width } as DOMRect)
  return el
}

describe('constrain', () => {
  it('black never passes white', () => {
    expect(constrain({ black: 250, gamma: 1, white: 100 }, 255, 'black')).toEqual({
      black: 98,
      gamma: 1,
      white: 100,
    })
    expect(constrain({ black: 50, gamma: 1, white: 10 }, 255, 'white')).toEqual({
      black: 50,
      gamma: 1,
      white: 52,
    })
    expect(constrain({ black: -5, gamma: 20, white: 300 }, 255, 'black')).toEqual({
      black: 0,
      gamma: 9.9,
      white: 255,
    })
  })
})

describe('LevelsSlider', () => {
  it('drag black past white clamps; handles have slider role', () => {
    renderWithProviders(<Harness initial={{ black: 0, gamma: 1, white: 100 }} />)
    track()
    const black = screen.getByRole('slider', { name: 'Точка чёрного' })
    fireEvent.pointerDown(black, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(black, { clientX: 200, pointerId: 1 })
    fireEvent.pointerUp(black, { pointerId: 1 })
    expect(black).toHaveAttribute('aria-valuenow', '98')
  })
  it('gamma handle drag: left of middle → γ > 1 and stays between', () => {
    renderWithProviders(<Harness initial={{ black: 0, gamma: 1, white: 200 }} />)
    track()
    const g = screen.getByRole('slider', { name: 'Полутона (гамма)' })
    fireEvent.pointerDown(g, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(g, { clientX: 50, pointerId: 1 })
    expect(Number(g.getAttribute('aria-valuenow'))).toBeCloseTo(2, 2)
    fireEvent.pointerMove(g, { clientX: 250, pointerId: 1 })
    expect(Number(g.getAttribute('aria-valuenow'))).toBe(0.1)
  })
  it('press on the strip grabs the nearest handle and jumps it there', () => {
    renderWithProviders(<Harness initial={{ black: 0, gamma: 1, white: 255 }} />)
    const el = track()
    fireEvent.pointerDown(el, { clientX: 230, pointerId: 1, button: 0 })
    fireEvent.pointerMove(el, { clientX: 220, pointerId: 1 })
    fireEvent.pointerUp(el, { pointerId: 1 })
    expect(screen.getByRole('slider', { name: 'Точка белого' })).toHaveAttribute(
      'aria-valuenow',
      '220',
    )
    expect(screen.getByRole('slider', { name: 'Точка белого' })).toHaveFocus()
  })
  it('keyboard arrows', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <Harness initial={{ black: 10, gamma: 1, white: 200 }} onChange={onChange} />,
    )
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Точка белого' }), {
      key: 'ArrowLeft',
      shiftKey: true,
    })
    expect(onChange).toHaveBeenLastCalledWith({ black: 10, gamma: 1, white: 190 })
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Полутона (гамма)' }), {
      key: 'ArrowLeft',
    })
    expect(onChange).toHaveBeenLastCalledWith({ black: 10, gamma: 1.01, white: 190 })
  })
})

describe('Histogram', () => {
  it('draws bars, log label', () => {
    const bins = new Uint32Array(256)
    bins[3] = 10
    const { container, rerender } = renderWithProviders(<Histogram bins={bins} log={false} />)
    expect(container.querySelector('path')!.getAttribute('d')).toContain('M3 ')
    rerender(<Histogram bins={bins} log />)
    expect(screen.getByRole('img', { name: /логарифмическая/ })).toBeInTheDocument()
  })
})
