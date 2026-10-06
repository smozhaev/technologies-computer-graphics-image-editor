import { LevelsDialog } from '@/features/adjust-levels'
import {
  DropOverlay,
  openAndNotify,
  OpenFileProvider,
  useWindowFileDrop,
} from '@/features/open-file'
import { ResizeDialog } from '@/features/resize-image'
import { SaveDialog } from '@/features/save-file'
import { Viewport } from '@/widgets/canvas-viewport'
import { EditorLayout } from '@/widgets/editor-layout'
import { MenuBar } from '@/widgets/menu-bar'
import { SidePanel } from '@/widgets/side-panel'
import { StatusBar } from '@/widgets/status-bar'
import { ToolBar } from '@/widgets/toolbar'
import { useEditorHotkeys } from '../model/useEditorHotkeys'

function EditorShell() {
  useEditorHotkeys()
  const dragging = useWindowFileDrop(openAndNotify)
  return (
    <>
      <DropOverlay visible={dragging} />
      <EditorLayout
        menuBar={<MenuBar />}
        toolBar={<ToolBar />}
        viewport={<Viewport />}
        sidePanel={<SidePanel />}
        statusBar={<StatusBar />}
      />
    </>
  )
}

/** The only page: editor shell plus all modal dialogs. */
export function EditorPage() {
  return (
    <OpenFileProvider>
      <EditorShell />
      <SaveDialog />
      <LevelsDialog />
      <ResizeDialog />
    </OpenFileProvider>
  )
}
