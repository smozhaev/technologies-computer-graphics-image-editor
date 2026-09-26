import type { ReactNode } from 'react'
import classes from './EditorLayout.module.css'

interface EditorLayoutProps {
  menuBar: ReactNode
  toolBar: ReactNode
  viewport: ReactNode
  sidePanel: ReactNode
  statusBar: ReactNode
}

/** Editor grid: menu bar · (tool bar | viewport | side panel) · status bar. */
export function EditorLayout({
  menuBar,
  toolBar,
  viewport,
  sidePanel,
  statusBar,
}: EditorLayoutProps) {
  return (
    <div className={classes.root}>
      {menuBar}
      <div className={classes.main}>
        {toolBar}
        <div className={classes.center}>{viewport}</div>
        {sidePanel}
      </div>
      {statusBar}
    </div>
  )
}
