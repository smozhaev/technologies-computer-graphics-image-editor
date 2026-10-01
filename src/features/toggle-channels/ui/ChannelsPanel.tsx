import { ActionIcon, Group, Text, UnstyledButton } from '@mantine/core'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { useMemo, type ReactNode } from 'react'
import {
  editorStore,
  showAllColourChannels,
  soloChannel,
  toggleChannel,
  useEditor,
} from '@/entities/editor'
import {
  CHANNEL_LABEL,
  channelsForLayout,
  channelThumbnail,
  isGrayLayout,
  resample,
  type ChannelId,
  type RasterImage,
} from '@/shared/lib/image'
import { CanvasView } from '@/shared/ui'
import classes from './ChannelsPanel.module.css'

const THUMB_W = 72
const THUMB_H = 48

function useDpr(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
}

function Thumb({ raster, dpr }: { raster: RasterImage; dpr: number }) {
  return (
    <div className={classes.thumb}>
      <CanvasView raster={raster} cssWidth={raster.width / dpr} cssHeight={raster.height / dpr} />
    </div>
  )
}

interface RowProps {
  label: string
  channel: ChannelId | 'rgb'
  on: boolean
  thumb: ReactNode
  /** Eye button; absent on the composite row. */
  onToggle?: () => void
  onSelect: () => void
  selectHint: string
}

function Row({ label, channel, on, thumb, onToggle, onSelect, selectHint }: RowProps) {
  return (
    <div className={classes.row} data-on={on || undefined} data-channel={channel}>
      {onToggle ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={`${on ? 'Скрыть' : 'Показать'} канал «${label}»`}
          onClick={onToggle}
        >
          {on ? <IconEye size={14} /> : <IconEyeOff size={14} />}
        </ActionIcon>
      ) : (
        <span className={classes.eyeSpacer} />
      )}
      <UnstyledButton
        className={classes.select}
        aria-pressed={on}
        aria-label={`Канал «${label}»`}
        title={selectHint}
        onClick={onSelect}
      >
        <Group gap="sm" wrap="nowrap">
          {thumb}
          <Text size="xs">{label}</Text>
        </Group>
      </UnstyledButton>
    </div>
  )
}

function ChannelRow({ image, id, on }: { image: RasterImage; id: ChannelId; on: boolean }) {
  const dpr = useDpr()
  const thumb = useMemo(
    () => channelThumbnail(image, id, THUMB_W * dpr, THUMB_H * dpr),
    [image, id, dpr],
  )
  return (
    <Row
      label={CHANNEL_LABEL[id]}
      channel={id}
      on={on}
      thumb={<Thumb raster={thumb} dpr={dpr} />}
      onToggle={() => editorStore.setState((s) => toggleChannel(s, id))}
      onSelect={() => editorStore.setState((s) => soloChannel(s, id))}
      selectHint="Показать только этот канал"
    />
  )
}

function CompositeRow({ image, on }: { image: RasterImage; on: boolean }) {
  const dpr = useDpr()
  const thumb = useMemo(() => {
    const scale = Math.min((THUMB_W * dpr) / image.width, (THUMB_H * dpr) / image.height, 1)
    return resample(
      image,
      Math.max(1, Math.round(image.width * scale)),
      Math.max(1, Math.round(image.height * scale)),
    )
  }, [image, dpr])
  return (
    <Row
      label="RGB"
      channel="rgb"
      on={on}
      thumb={<Thumb raster={thumb} dpr={dpr} />}
      onSelect={() => editorStore.setState(showAllColourChannels)}
      selectHint="Показать все цветовые каналы"
    />
  )
}

/** Channel thumbnails of the current image: composite row, eye toggles, click shows one channel. */
export function ChannelsPanel() {
  const doc = useEditor((s) => s.doc)
  const channels = useEditor((s) => s.channels)
  const version = doc ? doc.versions[doc.currentIndex] : undefined
  if (!version) {
    return (
      <Text size="xs" c="dimmed">
        Нет изображения
      </Text>
    )
  }
  const ids = channelsForLayout(version.layout)
  const colour = !isGrayLayout(version.layout)
  return (
    <div role="group" aria-label="Каналы">
      {colour && <CompositeRow image={version.image} on={channels.r && channels.g && channels.b} />}
      {ids.map((id) => (
        <ChannelRow key={id} image={version.image} id={id} on={channels[id]} />
      ))}
    </div>
  )
}
