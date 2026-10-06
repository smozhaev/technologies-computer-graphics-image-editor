import { useHotkeys } from '@mantine/hooks'
import { ZOOM_PRESETS } from '@/shared/lib/image'
import { fitToView, setZoom } from '@/features/zoom-view'
import { undoVersion } from '@/features/undo-version'
import { editorStore, setDialog, type DialogKind } from '@/entities/editor'
import { useRequestOpen } from '@/features/open-file'

function openDialog(dialog: DialogKind) {
  const s = editorStore.getState()
  if (s.dialog !== null || !s.doc) return
  editorStore.setState((st) => setDialog(st, dialog))
}

const openSave = () => openDialog('save')

function setTool(tool: 'pointer' | 'eyedropper') {
  if (editorStore.getState().dialog !== null) return
  editorStore.setState((s) => (s.activeTool === tool ? s : { ...s, activeTool: tool }))
}

function stepZoom(dir: 1 | -1) {
  const { view, dialog } = editorStore.getState()
  if (dialog !== null) return
  const z = view.zoom
  const next =
    dir > 0
      ? ZOOM_PRESETS.find((p) => p > z + 1e-9)
      : [...ZOOM_PRESETS].reverse().find((p) => p < z - 1e-9)
  if (next !== undefined) setZoom(next)
}

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
    ['mod+L', () => openDialog('levels')],
    ['mod+alt+I', () => openDialog('resize')],
    [
      'mod+Z',
      () => {
        if (editorStore.getState().dialog === null) undoVersion()
      },
    ],
    ['mod+=', () => stepZoom(1)],
    ['mod+shift+=', () => stepZoom(1)],
    ['mod+-', () => stepZoom(-1)],
    ['mod+0', () => editorStore.getState().dialog === null && fitToView()],
    ['mod+1', () => editorStore.getState().dialog === null && setZoom(1)],
    ['I', () => setTool('eyedropper')],
    ['V', () => setTool('pointer')],
    ['mod+shift+S', openSave],
  ])
}
