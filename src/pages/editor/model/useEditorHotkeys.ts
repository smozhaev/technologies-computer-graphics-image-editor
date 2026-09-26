import { useHotkeys } from '@mantine/hooks'
import { editorStore, setDialog, type DialogKind } from '@/entities/editor'
import { useRequestOpen } from '@/features/open-file'

function openDialog(dialog: DialogKind) {
  const s = editorStore.getState()
  if (s.dialog !== null || !s.doc) return
  editorStore.setState((st) => setDialog(st, dialog))
}

const openSave = () => openDialog('save')

/** App hotkeys; all ignored while a dialog is open. */
export function useEditorHotkeys(): void {
  const requestOpen = useRequestOpen()
  useHotkeys([
    [
      'mod+O',
      () => {
        if (editorStore.getState().dialog === null) requestOpen()
      },
    ],
    ['mod+S', openSave],
    ['mod+shift+S', openSave],
  ])
}
