import { ActionIcon, Stack, Tooltip } from '@mantine/core'
import { IconColorPicker, IconPointer } from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { editorStore, useEditor, type EditorState } from '@/entities/editor'
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

/** Tools: pointer and eyedropper. */
export function ToolBar() {
  const active = useEditor((s) => s.activeTool)
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
      </Tooltip.Group>
    </Stack>
  )
}
