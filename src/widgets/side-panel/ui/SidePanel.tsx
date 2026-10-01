import { Divider, Stack, Text } from '@mantine/core'
import { useEditor } from '@/entities/editor'
import { ChannelsPanel } from '@/features/toggle-channels'
import { PickedInfo } from '@/features/pick-color'
import classes from './SidePanel.module.css'
import { formatLabel } from '@/entities/document'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap={4} p="sm">
      <Text size="xs" fw={600} tt="uppercase" c="dimmed">
        {title}
      </Text>
      {children}
    </Stack>
  )
}

export function SidePanel() {
  const doc = useEditor((s) => s.doc)
  return (
    <div className={classes.root}>
      <Section title="Каналы">
        <ChannelsPanel />
      </Section>
      <Divider />
      <Section title="Инфо">
        {doc ? (
          <>
            <Text size="xs">Файл: {doc.source.fileName}</Text>
            <Text size="xs">Формат: {formatLabel(doc.source.format)}</Text>
            <PickedInfo />
          </>
        ) : (
          <Text size="xs" c="dimmed">
            Нет изображения
          </Text>
        )}
      </Section>
    </div>
  )
}
