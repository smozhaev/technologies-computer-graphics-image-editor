import {
  Alert,
  Button,
  ColorInput,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { useDialogPortalTarget } from '@/shared/ui'
import { NativeDialog } from '@/shared/ui'
import type { Gb7MaskMode } from '@/shared/lib/image'
import type { SourceInfo } from '@/shared/lib/image'
import { defaultGb7MaskMode, saveAs, type SaveOptions } from '../model/save'
import { editorStore, setDialog, useEditor } from '@/entities/editor'
import { hexToRgb, stripExtension } from '../lib/save-form'

type Format = SaveOptions['format']

const EXT: Record<Format, string> = { png: '.png', jpeg: '.jpg', gb7: '.gb7' }

const MASK_HINT: Record<Gb7MaskMode, string> = {
  auto: 'Маска записывается, только если есть прозрачные пиксели (альфа < 128)',
  always: 'Бит 7 = альфа ≥ 128',
  never: 'Альфа-канал отбрасывается',
}

function SaveForm({ source, onCancel }: { source: SourceInfo; onCancel: () => void }) {
  const target = useDialogPortalTarget()
  const portal = target ? { portalProps: { target } } : {}
  const [name, setName] = useState(stripExtension(source.fileName))
  const [format, setFormat] = useState<Format>(source.format)
  const [quality, setQuality] = useState<number>(92)
  const [background, setBackground] = useState('#ffffff')
  const [mask, setMask] = useState<Gb7MaskMode>(defaultGb7MaskMode(source))
  const [nameError, setNameError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (name.trim() === '') {
      setNameError('Введите имя файла')
      return
    }
    const options: SaveOptions =
      format === 'png'
        ? { format, name }
        : format === 'jpeg'
          ? { format, name, quality, background: hexToRgb(background) }
          : { format, name, mask }
    setSubmitting(true)
    setSaveError(null)
    try {
      await saveAs(options)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Неизвестная ошибка при сохранении')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id="save-form" onSubmit={submit}>
      <Stack gap="sm">
        <TextInput
          label="Имя файла"
          data-autofocus
          value={name}
          error={nameError}
          rightSection={
            <Text size="xs" c="dimmed">
              {EXT[format]}
            </Text>
          }
          rightSectionWidth={40}
          onChange={(e) => {
            setName(e.currentTarget.value)
            setNameError(null)
          }}
        />
        <Stack gap={2}>
          <Text size="xs" fw={500}>
            Формат
          </Text>
          <SegmentedControl
            aria-label="Формат"
            value={format}
            onChange={(v) => setFormat(v as Format)}
            data={[
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPG' },
              { value: 'gb7', label: 'GB7' },
            ]}
          />
        </Stack>
        {format === 'jpeg' && (
          <>
            <NumberInput
              label="Качество"
              min={1}
              max={100}
              clampBehavior="strict"
              allowDecimal={false}
              value={quality}
              onChange={(v) => setQuality(typeof v === 'number' ? v : 92)}
            />
            <ColorInput
              label="Фон для прозрачных пикселей"
              format="hex"
              value={background}
              onChange={setBackground}
              {...portal}
            />
          </>
        )}
        {format === 'gb7' && (
          <>
            <Text size="xs" c="dimmed">
              Изображение будет сохранено в оттенках серого (7 бит)
            </Text>
            <Select
              label="Маска прозрачности"
              allowDeselect={false}
              value={mask}
              onChange={(v) => v && setMask(v as Gb7MaskMode)}
              data={[
                { value: 'auto', label: 'Авто' },
                { value: 'always', label: 'Всегда' },
                { value: 'never', label: 'Без маски' },
              ]}
              description={MASK_HINT[mask]}
              comboboxProps={portal}
            />
          </>
        )}
        {saveError && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Не удалось сохранить">
            {saveError}
          </Alert>
        )}
      </Stack>
      <Stack mt="md" align="flex-end">
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" onClick={onCancel} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            Сохранить
          </Button>
        </div>
      </Stack>
    </form>
  )
}

/** «Сохранить как…». Mounted once; open while dialog === 'save'. Errors shown inline. */
export function SaveDialog() {
  const opened = useEditor((s) => s.dialog === 'save')
  const source = useEditor((s) => s.doc?.source ?? null)
  const busy = useEditor((s) => s.busy)
  const close = () => {
    if (!busy) editorStore.setState((s) => setDialog(s, null))
  }
  return (
    <NativeDialog opened={opened && source !== null} onClose={close} title="Сохранить как">
      {source && <SaveForm source={source} onCancel={close} />}
    </NativeDialog>
  )
}
