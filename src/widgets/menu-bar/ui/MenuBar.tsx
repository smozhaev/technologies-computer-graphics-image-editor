import { Button, Group, Menu, Text } from '@mantine/core'
import { closeDocument, editorStore, setDialog, useEditor } from '@/entities/editor'
import { useRequestOpen } from '@/features/open-file'
import { shortcut } from '@/shared/lib/shortcut'
import classes from './MenuBar.module.css'

const hint = (s: string) => (
  <Text size="xs" c="dimmed">
    {s}
  </Text>
)

export function MenuBar() {
  const requestOpen = useRequestOpen()
  const hasDoc = useEditor((s) => s.doc !== null)
  return (
    <Group gap={0} className={classes.root} role="menubar">
      <Text size="sm" fw={700} px="sm" className={classes.brand} aria-label="GrayBit Studio">
        GrayBit<span className={classes.brandAccent}> Studio</span>
      </Text>
      <Menu position="bottom-start">
        <Menu.Target>
          <Button variant="subtle" color="gray">
            Файл
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={requestOpen} rightSection={hint(shortcut('O'))}>
            Открыть…
          </Menu.Item>
          <Menu.Item
            disabled={!hasDoc}
            onClick={() => editorStore.setState((s) => setDialog(s, 'save'))}
            rightSection={hint(shortcut('S'))}
          >
            Сохранить как…
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item disabled={!hasDoc} onClick={() => editorStore.setState(closeDocument)}>
            Закрыть
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  )
}
