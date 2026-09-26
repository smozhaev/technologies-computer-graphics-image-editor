import { Group, Text } from '@mantine/core'
import { formatStatusText } from '@/entities/document'
import { useEditor } from '@/entities/editor'
import classes from './StatusBar.module.css'

/** File name · size, depth, format · zoom. */
export function StatusBar() {
  const doc = useEditor((s) => s.doc)
  const zoom = useEditor((s) => s.view.zoom)
  return (
    <Group className={classes.root} role="status" justify="space-between" wrap="nowrap" gap="md">
      <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
        {doc && (
          <Text size="xs" fw={500} truncate="end" maw={260} title={doc.source.fileName}>
            {doc.source.fileName}
          </Text>
        )}
        <Text size="xs" c="dimmed" truncate="end">
          {formatStatusText(doc)}
        </Text>
      </Group>
      {doc && (
        <Text size="xs" c="dimmed" ff="monospace">
          {Math.round(zoom * 100)} %
        </Text>
      )}
    </Group>
  )
}
