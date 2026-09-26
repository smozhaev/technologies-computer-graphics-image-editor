import { useEffect, useRef, useState } from 'react'
import { editorStore } from '@/entities/editor'

function hasFiles(e: DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types ?? []).includes('Files')
}

/**
 * Window-level drag and drop of files; the browser never navigates to a dropped file.
 * Returns true while files are dragged over the window (for the drop overlay).
 */
export function useWindowFileDrop(onFile: (file: File) => void): boolean {
  const onFileRef = useRef(onFile)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    onFileRef.current = onFile
  })
  useEffect(() => {
    // dragenter/dragleave fire for every child element, so count them
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!hasFiles(e) || editorStore.getState().dialog !== null) return
      depth++
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const over = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (!file || editorStore.getState().dialog !== null) return
      onFileRef.current(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [])
  return dragging
}
