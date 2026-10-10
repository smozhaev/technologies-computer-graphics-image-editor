import { ActionIcon, Button, Divider, Group, Popover, Stack, Text, Tooltip } from '@mantine/core'
import { IconColorPicker, IconFilter, IconPointer, IconTrash } from '@tabler/icons-react'
import { useState, type ComponentType } from 'react'
import {
  closeDocument,
  editorStore,
  setDialog,
  useEditor,
  type EditorState,
} from '@/entities/editor'
import { shortcut } from '@/shared/lib/shortcut'
import classes from './ToolBar.module.css'

interface Tool {
  id: EditorState['activeTool']
  label: string
  icon: ComponentType<{ size?: number }>
}

const TOOLS: Tool[] = [
  { id: 'pointer', label: 'Указатель (V)', icon: IconPointer },
  { id: 'eyedropper', label: 'Пипетка (I)', icon: IconColorPicker },
]

/** Tools (pointer, eyedropper) and quick actions: convolution filter, reset image (with confirmation). */
export function ToolBar() {
  const active = useEditor((s) => s.activeTool)
  const hasDoc = useEditor((s) => s.doc !== null)
  const [confirming, setConfirming] = useState(false)
  const filterLabel = `Свёртка 3×3 (${shortcut('F', true)})`
  return (
    <Stack gap={4} className={classes.root}>
      <Tooltip.Group openDelay={300} closeDelay={100}>
        {TOOLS.map((t) => (
          <Tooltip key={t.id} label={t.label} position="right">
            <ActionIcon
              aria-label={t.label}
              variant={active === t.id ? 'filled' : 'subtle'}
              color={active === t.id ? 'yellow' : 'gray'}
              onClick={() => editorStore.setState((s) => ({ ...s, activeTool: t.id }))}
            >
              <t.icon size={16} />
            </ActionIcon>
          </Tooltip>
        ))}
        <Divider my={4} />
        <Tooltip label={filterLabel} position="right">
          <ActionIcon
            aria-label={filterLabel}
            variant="subtle"
            color="gray"
            disabled={!hasDoc}
            onClick={() => editorStore.setState((s) => setDialog(s, 'filter'))}
          >
            <IconFilter size={16} />
          </ActionIcon>
        </Tooltip>
        <Popover
          opened={confirming}
          onChange={setConfirming}
          position="right-start"
          withArrow
          trapFocus
          returnFocus
        >
          <Popover.Target>
            <Tooltip label="Сбросить изображение" position="right" disabled={confirming}>
              <ActionIcon
                aria-label="Сбросить изображение"
                variant="filled"
                color="red"
                disabled={!hasDoc}
                onClick={() => setConfirming((o) => !o)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap={8} maw={220}>
              <Text size="sm" fw={600}>
                Сбросить изображение?
              </Text>
              <Text size="xs" c="dimmed">
                Холст очистится, сохранённая копия удалится. Отменить нельзя.
              </Text>
              <Group gap={6} justify="flex-end">
                <Button variant="default" size="xs" onClick={() => setConfirming(false)}>
                  Отмена
                </Button>
                <Button
                  color="red"
                  size="xs"
                  data-autofocus
                  onClick={() => {
                    setConfirming(false)
                    editorStore.setState(closeDocument)
                  }}
                >
                  Сбросить
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Tooltip.Group>
    </Stack>
  )
}
