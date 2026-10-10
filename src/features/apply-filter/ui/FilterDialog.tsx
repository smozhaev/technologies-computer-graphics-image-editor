import {
  Button,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDialogPortalTarget } from '@/shared/ui'
import { NativeDialog } from '@/shared/ui'
import { PRESETS, type FilterChannels, type PaddingMode, type PresetId } from '@/shared/lib/image'
import {
  isGrayLayout,
  layoutHasAlpha,
  type ImageVersion,
  type RasterImage,
} from '@/shared/lib/image'
import { applyFilterResult } from '../model/apply'
import { editorStore, setDialog, useEditor } from '@/entities/editor'
import type { ConvolveParams } from '@/shared/lib/worker'
import { getRunner } from '@/shared/lib/worker'

type PresetChoice = PresetId | 'custom'
type Field = number | string

const DEBOUNCE_MS = 120
const num = (v: Field, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

function setPreviewImage(img: RasterImage | null) {
  editorStore.setState((s) => (s.filterPreview === img ? s : { ...s, filterPreview: img }))
}

function FilterForm({ version, onClose }: { version: ImageVersion; onClose: () => void }) {
  const target = useDialogPortalTarget()
  const portal = target ? { portalProps: { target } } : {}
  const gray = isGrayLayout(version.layout)
  const hasAlpha = layoutHasAlpha(version.layout)

  const [preset, setPreset] = useState<PresetChoice>('identity')
  const [weights, setWeights] = useState<Field[]>([...PRESETS.identity.kernel.weights])
  const [divisor, setDivisor] = useState<Field>(1)
  const [offset, setOffset] = useState<Field>(0)
  const [channels, setChannels] = useState<FilterChannels>({ r: true, g: true, b: true, a: false })
  const [mode, setMode] = useState<PaddingMode>('replicate')
  const [preview, setPreviewOn] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // last finished preview; the spinner is derived from it, so a superseded run cannot leave it on
  const [shown, setShown] = useState<{
    key: string
    source: RasterImage
    image: RasterImage
  } | null>(null)
  const alive = useRef(true)

  const div = num(divisor, 1)
  const kernelSum = Math.round(weights.reduce<number>((a, w) => a + num(w, 0), 0) * 10000) / 10000
  const params: ConvolveParams = useMemo(
    () => ({
      kernel: {
        weights: weights.map((w) => num(w, 0)),
        divisor: div === 0 ? 1 : div,
        offset: num(offset, 0),
      },
      channels,
      mode,
      levelMax: version.levelMax,
    }),
    [weights, div, offset, channels, mode, version.levelMax],
  )
  const key = JSON.stringify(params)
  const divisorError = div === 0 ? 'Делитель не может быть 0' : null
  const fresh = shown && shown.key === key && shown.source === version.image ? shown : null
  const previewBusy = preview && !fresh && !error

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      setPreviewImage(null)
    }
  }, [])

  useEffect(() => {
    if (!preview) {
      setPreviewImage(null)
      return
    }
    if (fresh) {
      setPreviewImage(fresh.image)
      return
    }
    // results of a superseded run (params changed, preview switched off) are ignored
    let cancelled = false
    const source = version.image
    const t = setTimeout(() => {
      getRunner()
        .convolve(source, params, 'preview')
        .then((img) => {
          if (cancelled || !alive.current || !img) return
          setShown({ key, source, image: img })
          setPreviewImage(img)
        })
        .catch((e: unknown) => {
          if (cancelled || !alive.current) return
          setError(e instanceof Error ? e.message : String(e))
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [key, params, preview, version.image, fresh])

  function choosePreset(id: PresetChoice) {
    setPreset(id)
    if (id === 'custom') return
    const k = PRESETS[id].kernel
    setWeights([...k.weights])
    setDivisor(k.divisor)
    setOffset(k.offset)
  }
  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPreset('custom')
    }
  }
  function reset() {
    choosePreset('identity')
    setChannels({ r: true, g: true, b: true, a: false })
    setMode('replicate')
    setError(null)
  }
  async function apply() {
    if (divisorError) return
    setBusy(true)
    try {
      const img = fresh ? fresh.image : await getRunner().convolve(version.image, params, 'apply')
      if (img && alive.current) applyFilterResult(img)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const setColour = (on: boolean) => setChannels((c) => ({ ...c, r: on, g: on, b: on }))

  return (
    <Stack gap="sm" w={380}>
      <Select
        label="Пресет"
        allowDeselect={false}
        value={preset}
        onChange={(v) => v && choosePreset(v as PresetChoice)}
        data={[
          ...Object.entries(PRESETS).map(([id, p]) => ({ value: id, label: p.name })),
          { value: 'custom', label: 'Своё' },
        ]}
        comboboxProps={portal}
      />
      <div>
        <Text size="xs" fw={500} mb={4}>
          Ядро 3×3
        </Text>
        <SimpleGrid cols={3} spacing={4} verticalSpacing={4} w={210} role="group" aria-label="Ядро">
          {weights.map((w, i) => (
            <NumberInput
              key={i}
              aria-label={`Вес ${Math.floor(i / 3) + 1}.${(i % 3) + 1}`}
              value={w}
              hideControls
              decimalScale={4}
              onChange={edit((v: Field) => setWeights((ws) => ws.map((x, j) => (j === i ? v : x))))}
            />
          ))}
        </SimpleGrid>
      </div>
      <Group grow gap="xs" align="flex-start">
        <NumberInput
          label="Делитель"
          value={divisor}
          decimalScale={4}
          onChange={edit(setDivisor)}
          error={divisorError}
          rightSectionWidth={56}
          rightSection={
            <Button
              size="compact-xs"
              variant="subtle"
              title="Делитель = сумма весов ядра (если она не 0)"
              disabled={kernelSum === 0}
              onClick={() => {
                setDivisor(kernelSum)
                setPreset('custom')
              }}
            >
              Σ
            </Button>
          }
        />
        <NumberInput label="Смещение" value={offset} decimalScale={2} onChange={edit(setOffset)} />
      </Group>
      <Group gap="md">
        {gray ? (
          <Checkbox
            label="Серый"
            checked={channels.r}
            onChange={(e) => setColour(e.currentTarget.checked)}
          />
        ) : (
          (['r', 'g', 'b'] as const).map((c) => (
            <Checkbox
              key={c}
              label={{ r: 'R', g: 'G', b: 'B' }[c]}
              checked={channels[c]}
              onChange={(e) => {
                const on = e.currentTarget.checked
                setChannels((ch) => ({ ...ch, [c]: on }))
              }}
            />
          ))
        )}
        {hasAlpha && (
          <Checkbox
            label="Альфа"
            checked={channels.a}
            onChange={(e) => {
              const on = e.currentTarget.checked
              setChannels((ch) => ({ ...ch, a: on }))
            }}
          />
        )}
      </Group>
      <Select
        label="Края"
        allowDeselect={false}
        value={mode}
        onChange={(v) => v && setMode(v as PaddingMode)}
        data={[
          { value: 'replicate', label: 'Копировать крайние пиксели' },
          { value: 'black', label: 'Заполнить чёрным' },
          { value: 'white', label: 'Заполнить белым' },
        ]}
        comboboxProps={portal}
      />
      <Group justify="space-between">
        <Checkbox
          label="Предпросмотр"
          checked={preview}
          onChange={(e) => setPreviewOn(e.currentTarget.checked)}
        />
        {(busy || previewBusy) && <Loader size="xs" aria-label="Вычисление" />}
      </Group>
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={reset}>
          Сбросить
        </Button>
        <Button variant="default" onClick={onClose}>
          Закрыть
        </Button>
        <Button onClick={() => void apply()} disabled={!!divisorError} loading={busy && !preview}>
          Применить
        </Button>
      </Group>
    </Stack>
  )
}

/** «Свёртка 3×3». Open while dialog === 'filter'. */
export function FilterDialog() {
  const opened = useEditor((s) => s.dialog === 'filter')
  const version = useEditor((s) => (s.doc ? s.doc.versions[s.doc.currentIndex] : undefined))
  const close = () => editorStore.setState((s) => setDialog({ ...s, filterPreview: null }, null))
  return (
    <NativeDialog floating opened={opened && !!version} onClose={close} title="Фильтр: свёртка 3×3">
      {version && <FilterForm version={version} onClose={close} />}
    </NativeDialog>
  )
}
