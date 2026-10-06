import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useDialogPortalTarget } from '@/shared/ui'
import { NativeDialog } from '@/shared/ui'
import type { RasterImage } from '@/shared/lib/image'
import { DEFAULT_INTERPOLATOR, INTERPOLATORS, type InterpolatorId } from '@/shared/lib/image'
import { fromPixels, megapixels, toPixels, validateSize, type SizeUnit } from '@/shared/lib/image'
import { resizeDocument } from '../model/resize'
import { editorStore, setDialog, useEditor } from '@/entities/editor'

type Field = number | string

function ResizeForm({ image, onClose }: { image: RasterImage; onClose: () => void }) {
  const target = useDialogPortalTarget()
  const portal = target ? { portalProps: { target } } : {}
  const orig = { width: image.width, height: image.height }
  const [unit, setUnit] = useState<SizeUnit>('px')
  const [width, setWidth] = useState<Field>(image.width)
  const [height, setHeight] = useState<Field>(image.height)
  const [lock, setLock] = useState(true)
  const [method, setMethod] = useState<InterpolatorId>(DEFAULT_INTERPOLATOR)

  const errors = validateSize(width, height, unit, orig)
  const valid = !errors.width && !errors.height && !errors.total
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const newW = valid ? toPixels(width as number, unit, orig.width) : null
  const newH = valid ? toPixels(height as number, unit, orig.height) : null
  const ratio = orig.width / orig.height

  function changeWidth(v: Field) {
    setWidth(v)
    if (lock && typeof v === 'number' && v > 0) {
      const px = toPixels(v, unit, orig.width)
      setHeight(fromPixels(Math.max(1, Math.round(px / ratio)), unit, orig.height))
    }
  }
  function changeHeight(v: Field) {
    setHeight(v)
    if (lock && typeof v === 'number' && v > 0) {
      const px = toPixels(v, unit, orig.height)
      setWidth(fromPixels(Math.max(1, Math.round(px * ratio)), unit, orig.width))
    }
  }
  function changeUnit(u: SizeUnit) {
    if (u === unit) return
    const w = typeof width === 'number' ? toPixels(width, unit, orig.width) : orig.width
    const h = typeof height === 'number' ? toPixels(height, unit, orig.height) : orig.height
    setUnit(u)
    setWidth(fromPixels(w, u, orig.width))
    setHeight(fromPixels(h, u, orig.height))
  }

  const suffix = unit === 'px' ? ' px' : ' %'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!newW || !newH || busy) return
        setBusy(true)
        setFailure(null)
        resizeDocument(newW, newH, method)
          .catch((err: unknown) => setFailure(err instanceof Error ? err.message : String(err)))
          .finally(() => setBusy(false))
      }}
    >
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <Stack gap="sm" w={360}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Сейчас: {orig.width} × {orig.height} px · {megapixels(orig.width, orig.height)}
            </Text>
            <Text size="xs" aria-label="Новый размер">
              Станет: {newW && newH ? `${newW} × ${newH} px · ${megapixels(newW, newH)}` : '—'}
            </Text>
          </Group>
          <Select
            label="Единицы"
            allowDeselect={false}
            value={unit}
            onChange={(v) => v && changeUnit(v as SizeUnit)}
            data={[
              { value: 'px', label: 'Пиксели' },
              { value: 'percent', label: 'Проценты' },
            ]}
            comboboxProps={portal}
          />
          <Group grow gap="xs" align="flex-start">
            <NumberInput
              label="Ширина"
              data-autofocus
              value={width}
              onChange={changeWidth}
              suffix={suffix}
              decimalScale={unit === 'px' ? 0 : 2}
              min={0}
              clampBehavior="none"
              error={errors.width}
            />
            <NumberInput
              label="Высота"
              value={height}
              onChange={changeHeight}
              suffix={suffix}
              decimalScale={unit === 'px' ? 0 : 2}
              min={0}
              clampBehavior="none"
              error={errors.height}
            />
          </Group>
          <Checkbox
            label="Сохранять пропорции"
            checked={lock}
            onChange={(e) => {
              setLock(e.currentTarget.checked)
              if (e.currentTarget.checked) changeWidth(width)
            }}
          />
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Select
              label="Интерполяция"
              allowDeselect={false}
              value={method}
              onChange={(v) => v && setMethod(v as InterpolatorId)}
              data={Object.values(INTERPOLATORS).map((ip) => ({ value: ip.id, label: ip.name }))}
              comboboxProps={portal}
              style={{ flex: 1 }}
            />
            <Tooltip label={INTERPOLATORS[method].description} multiline w={260} {...portal}>
              <ActionIcon variant="subtle" color="gray" aria-label="Об алгоритме" size="md">
                <IconInfoCircle size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          {errors.total && (
            <Text size="xs" c="red">
              {errors.total}
            </Text>
          )}
          {failure && (
            <Alert color="red" title="Не удалось изменить размер">
              {failure}
            </Alert>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={!valid || busy} loading={busy}>
              Применить
            </Button>
          </Group>
        </Stack>
      </fieldset>
    </form>
  )
}

/** «Размер изображения». Open while dialog === 'resize'. */
export function ResizeDialog() {
  const opened = useEditor((s) => s.dialog === 'resize')
  const image = useEditor((s) => (s.doc ? s.doc.versions[s.doc.currentIndex]?.image : undefined))
  const close = () => editorStore.setState((s) => setDialog(s, null))
  return (
    <NativeDialog opened={opened && !!image} onClose={close} title="Размер изображения">
      {image && <ResizeForm image={image} onClose={close} />}
    </NativeDialog>
  )
}
