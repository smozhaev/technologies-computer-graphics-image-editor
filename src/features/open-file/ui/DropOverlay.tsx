import { Stack, Text } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'
import classes from './DropOverlay.module.css'

/** Full-window hint while a file is dragged over the editor. */
export function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className={classes.overlay} aria-live="polite" data-testid="drop-overlay">
      <Stack align="center" gap={6} className={classes.box}>
        <IconUpload size={36} />
        <Text fw={600}>Отпустите, чтобы открыть</Text>
        <Text size="xs" c="dimmed">
          PNG · JPG · GB7
        </Text>
      </Stack>
    </div>
  )
}
