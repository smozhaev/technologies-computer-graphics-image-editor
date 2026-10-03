import {
  Button,
  Checkbox,
  Loader,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
} from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDialogPortalTarget } from '@/shared/ui'
import { NativeDialog } from '@/shared/ui'
import { histogram, type HistogramChannel } from '@/shared/lib/image'
import { layoutHasAlpha, isGrayLayout, type ImageVersion } from '@/shared/lib/image'
import {
  buildLevelsLuts,
  clampGamma,
  identitySettings,
  type LevelsChannel,
  type LevelsParams,
  type LevelsSettings,
} from '@/shared/lib/image'
import { applyLevelsToDocument } from '../model/apply'
import { editorStore, setDialog, useEditor } from '@/entities/editor'
import { Histogram } from './Histogram'
import { LevelsSlider } from './LevelsSlider'

const HIST_CHANNEL: Record<LevelsChannel, HistogramChannel> = {
  master: 'luma',
  r: 'r',
  g: 'g',
  b: 'b',
  a: 'a',
}

function channelOptions(v: ImageVersion): { value: LevelsChannel; label: string }[] {
  const gray = isGrayLayout(v.layout)
  const opts: { value: LevelsChannel; label: string }[] = gray
    ? [{ value: 'master', label: 'Серый (все)' }]
    : [
        { value: 'master', label: 'RGB (все)' },
        { value: 'r', label: 'Красный' },
        { value: 'g', label: 'Зелёный' },
        { value: 'b', label: 'Синий' },
      ]
  if (layoutHasAlpha(v.layout)) opts.push({ value: 'a', label: 'Альфа' })
  return opts
}

interface LevelInputProps {
  label: string
  value: number
  min: number
  max: number
  decimals?: number
  step?: number
  onCommit: (v: number) => void
}

/** Number field with a local draft: commits only valid values while typing, clamps on blur. */
function LevelInput({ label, value, min, max, decimals = 0, step = 1, onCommit }: LevelInputProps) {
  const [draft, setDraft] = useState<string | number>(value)
  const [lastValue, setLastValue] = useState(value)
  if (lastValue !== value) {
    setLastValue(value)
    setDraft(value)
  }
  return (
    <NumberInput
      label={label}
      value={draft}
      step={step}
      min={min}
      max={max}
      decimalScale={decimals}
      allowDecimal={decimals > 0}
      clampBehavior="none"
      onChange={(v) => {
        setDraft(v)
        if (typeof v === 'number' && v >= min && v <= max) onCommit(v)
      }}
      onBlur={() => {
        const n = typeof draft === 'number' ? draft : Number(draft)
        const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value
        setDraft(clamped)
        if (clamped !== value) onCommit(clamped)
      }}
    />
  )
}

function setPreview(luts: ReturnType<typeof buildLevelsLuts>) {
  editorStore.setState((s) => (s.levelsPreview === luts ? s : { ...s, levelsPreview: luts }))
}

function LevelsForm({ version, onClose }: { version: ImageVersion; onClose: () => void }) {
  const target = useDialogPortalTarget()
  const max = version.levelMax
  const [settings, setSettings] = useState<LevelsSettings>(() => identitySettings(max))
  const [channel, setChannel] = useState<LevelsChannel>('master')
  const [log, setLog] = useState(false)
  const [preview, setPreviewOn] = useState(true)
  const frame = useRef<number | null>(null)

  const luts = useMemo(() => buildLevelsLuts(settings, max), [settings, max])
  // histogram of a large image is computed after the dialog has painted
  const [bins, setBins] = useState<Uint32Array | null>(null)
  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (!cancelled) setBins(histogram(version.image, HIST_CHANNEL[channel], max))
    }
    const id = setTimeout(run, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [version.image, channel, max])

  // throttle canvas preview to one update per frame
  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      setPreview(preview ? luts : null)
    })
  }, [luts, preview])

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      setPreview(null)
    },
    [],
  )

  const params = settings[channel]
  const set = (p: LevelsParams) => setSettings((s) => ({ ...s, [channel]: p }))

  return (
    <Stack gap="sm" w={420}>
      <Group justify="space-between" align="flex-end">
        <Select
          label="Канал"
          w={180}
          allowDeselect={false}
          value={channel}
          onChange={(v) => v && setChannel(v as LevelsChannel)}
          data={channelOptions(version)}
          comboboxProps={target ? { portalProps: { target } } : {}}
        />
        <SegmentedControl
          aria-label="Шкала гистограммы"
          value={log ? 'log' : 'lin'}
          onChange={(v) => setLog(v === 'log')}
          data={[
            { value: 'lin', label: 'Линейная' },
            { value: 'log', label: 'Логарифм.' },
          ]}
        />
      </Group>
      <div>
        {bins ? (
          <Histogram bins={bins} log={log} />
        ) : (
          <div style={{ height: 120, display: 'grid', placeItems: 'center' }}>
            <Loader size="xs" aria-label="Расчёт гистограммы" />
          </div>
        )}
        <LevelsSlider value={params} max={max} onChange={set} />
      </div>
      <Group grow gap="xs">
        <LevelInput
          label="Чёрный"
          min={0}
          max={params.white - 2}
          value={params.black}
          onCommit={(v) => set({ ...params, black: v })}
        />
        <LevelInput
          label="Гамма"
          min={0.1}
          max={9.9}
          step={0.01}
          decimals={2}
          value={params.gamma}
          onCommit={(v) => set({ ...params, gamma: clampGamma(v) })}
        />
        <LevelInput
          label="Белый"
          min={params.black + 2}
          max={max}
          value={params.white}
          onCommit={(v) => set({ ...params, white: v })}
        />
      </Group>
      <Checkbox
        label="Предпросмотр"
        checked={preview}
        onChange={(e) => setPreviewOn(e.currentTarget.checked)}
      />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={() => setSettings(identitySettings(max))}>
          Сброс
        </Button>
        <Button variant="default" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={() => applyLevelsToDocument(luts)}>Применить</Button>
      </Group>
    </Stack>
  )
}

/** «Уровни». Open while dialog === 'levels'. */
export function LevelsDialog() {
  const opened = useEditor((s) => s.dialog === 'levels')
  const version = useEditor((s) => (s.doc ? s.doc.versions[s.doc.currentIndex] : undefined))
  const close = () => editorStore.setState((s) => setDialog({ ...s, levelsPreview: null }, null))
  return (
    <NativeDialog floating opened={opened && !!version} onClose={close} title="Уровни">
      {version && <LevelsForm version={version} onClose={close} />}
    </NativeDialog>
  )
}
