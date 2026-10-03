import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  clampGamma,
  constrainLevels as constrain,
  gammaToPosition,
  LEVELS_MIN_GAP as MIN_GAP,
  positionToGamma,
  type LevelsHandle,
  type LevelsParams,
} from '@/shared/lib/image'
import classes from './LevelsSlider.module.css'

type Handle = LevelsHandle

interface LevelsSliderProps {
  value: LevelsParams
  max: number
  onChange: (next: LevelsParams) => void
}

const HANDLES: Handle[] = ['black', 'gamma', 'white']

/**
 * Three handles under the histogram: black, midtones (gamma), white.
 * A press anywhere on the strip grabs the nearest handle; each handle has a 20×24 px hit area.
 */
export function LevelsSlider({ value, max, onChange }: LevelsSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<Handle | null>(null)
  const pos: Record<Handle, number> = {
    black: value.black,
    gamma: gammaToPosition(value),
    white: value.white,
  }

  function levelAt(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.min(max, Math.max(0, ((clientX - rect.left) / rect.width) * max))
  }

  function update(handle: Handle, level: number) {
    if (handle === 'gamma') {
      const p = Math.min(Math.max(level, value.black), value.white)
      onChange({
        ...value,
        gamma: Math.round(positionToGamma(p, value.black, value.white) * 100) / 100,
      })
    } else {
      onChange(constrain({ ...value, [handle]: level }, max, handle))
    }
  }

  function nearest(level: number): Handle {
    // ties go to the handle that can move towards the press
    return HANDLES.reduce((best, h) =>
      Math.abs(pos[h] - level) < Math.abs(pos[best] - level) ? h : best,
    )
  }

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    const handle = (target.dataset.handle as Handle | undefined) ?? nearest(levelAt(e.clientX))
    dragging.current = handle
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.preventDefault()
    // pressing the strip (not a handle) jumps the nearest handle there
    if (!target.dataset.handle) update(handle, levelAt(e.clientX))
    trackRef.current?.querySelector<HTMLElement>(`[data-handle='${handle}']`)?.focus()
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) update(dragging.current, levelAt(e.clientX))
  }
  const up = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }
  const key = (h: Handle) => (e: KeyboardEvent<HTMLDivElement>) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    if (h === 'gamma')
      onChange({
        ...value,
        gamma: Math.round(clampGamma(value.gamma - dir * 0.01 * step) * 100) / 100,
      })
    else update(h, value[h] + dir * step)
  }

  const meta: Record<
    Handle,
    { label: string; now: number; min: number; max: number; text: string }
  > = {
    black: {
      label: 'Точка чёрного',
      now: value.black,
      min: 0,
      max: value.white - MIN_GAP,
      text: String(value.black),
    },
    gamma: {
      label: 'Полутона (гамма)',
      now: value.gamma,
      min: 0.1,
      max: 9.9,
      text: value.gamma.toFixed(2),
    },
    white: {
      label: 'Точка белого',
      now: value.white,
      min: value.black + MIN_GAP,
      max,
      text: String(value.white),
    },
  }

  return (
    <div
      ref={trackRef}
      className={classes.track}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className={classes.gradient} />
      {HANDLES.map((h) => {
        const m = meta[h]
        return (
          <div
            key={h}
            role="slider"
            tabIndex={0}
            aria-label={m.label}
            aria-valuenow={m.now}
            aria-valuemin={m.min}
            aria-valuemax={m.max}
            aria-valuetext={m.text}
            data-handle={h}
            className={classes.handle}
            style={{ left: `${(pos[h] / max) * 100}%` }}
            onKeyDown={key(h)}
          />
        )
      })}
    </div>
  )
}
