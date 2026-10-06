import { ActionIcon, Group, Select, Slider, Stack, Text, Tooltip } from '@mantine/core'
import { IconArrowsMinimize } from '@tabler/icons-react'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_PRESETS } from '@/shared/lib/image'
import { INTERPOLATORS, type InterpolatorId } from '@/shared/lib/image'
import { fitToView, setZoom } from '../model/zoom'
import { editorStore, useEditor } from '@/entities/editor'

const pct = (z: number) => `${Math.round(z * 100)} %`

/** Zoom 12–300 % (presets + slider), fit button, view interpolation. */
export function ZoomControl() {
  const zoom = useEditor((s) => s.view.zoom)
  const method = useEditor((s) => s.interpolation)
  const presets = ZOOM_PRESETS.map((z) => ({ value: String(z), label: pct(z) }))
  const current = String(zoom)
  const data = presets.some((p) => p.value === current)
    ? presets
    : [{ value: current, label: pct(zoom) }, ...presets]
  return (
    <Stack gap={6} mt={6}>
      <Group gap={6} wrap="nowrap" align="flex-end">
        <Select
          label="Масштаб"
          aria-label="Масштаб"
          allowDeselect={false}
          value={current}
          data={data}
          onChange={(v) => v && setZoom(Number(v))}
          style={{ flex: 1 }}
        />
        <Tooltip label="Вписать в окно (Ctrl+0)">
          <ActionIcon variant="default" aria-label="Вписать в окно" onClick={fitToView} size="md">
            <IconArrowsMinimize size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Slider
        aria-label="Ползунок масштаба"
        min={ZOOM_MIN * 100}
        max={ZOOM_MAX * 100}
        step={1}
        value={Math.round(zoom * 100)}
        onChange={(v) => setZoom(v / 100)}
        label={(v) => `${v} %`}
        size="xs"
      />
      <Select
        label="Интерполяция отображения"
        allowDeselect={false}
        value={method}
        data={Object.values(INTERPOLATORS).map((ip) => ({ value: ip.id, label: ip.name }))}
        onChange={(v) =>
          v && editorStore.setState((s) => ({ ...s, interpolation: v as InterpolatorId }))
        }
      />
      <Text size="xs" c="dimmed">
        На 100 % пиксели выводятся без интерполяции
      </Text>
    </Stack>
  )
}
