import { ActionIcon, Divider, Stack, Tooltip } from '@mantine/core'
import { IconColorPicker, IconFilter, IconPointer } from '@tabler/icons-react'
import type { ComponentType } from 'react'
import {
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

/** Tools (pointer, eyedropper) and quick action: convolution filter. */
export function ToolBar() {
  const active = useEditor((s) => s.activeTool)
  const hasDoc = useEditor((s) => s.doc !== null)
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
      </Tooltip.Group>
    </Stack>
  )
}
