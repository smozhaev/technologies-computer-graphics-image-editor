import { ActionIcon, Group, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { DialogPortalContext } from './DialogPortalContext'
import classes from './NativeDialog.module.css'

interface NativeDialogProps {
  opened: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  closeOnBackdrop?: boolean
  /**
   * Floating tool window for live previews: no dimming backdrop, placed at the top right,
   * dragged by its title bar. Still a modal <dialog>.
   */
  floating?: boolean
}

/** Modal window on the native <dialog> (showModal, top layer). Parent owns `opened`. */
export function NativeDialog({
  opened,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = false,
  floating = false,
}: NativeDialogProps) {
  const [el, setEl] = useState<HTMLDialogElement | null>(null)
  const titleId = useId()
  const openedRef = useRef(opened)
  const onCloseRef = useRef(onClose)
  const mountedRef = useRef(false)
  const wasOpen = useRef(false)
  const opener = useRef<HTMLElement | null>(null)
  const pressOnBackdrop = useRef(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragFrom = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useLayoutEffect(() => {
    openedRef.current = opened
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!el) return
    if (opened && !wasOpen.current) {
      const active = document.activeElement
      opener.current =
        active instanceof HTMLElement && active !== document.body && !el.contains(active)
          ? active
          : null
      if (!el.open) el.showModal()
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!opened && wasOpen.current) {
      if (el.open) el.close()
      if (opener.current?.isConnected) opener.current.focus()
      opener.current = null
    }
    wasOpen.current = opened
  }, [el, opened])

  useEffect(() => {
    if (!el) return
    mountedRef.current = true
    const onCancel = (e: Event) => {
      e.preventDefault()
      onCloseRef.current()
    }
    // Chrome may close on repeated Esc without a cancelable cancel
    const onNativeClose = () => {
      if (openedRef.current) onCloseRef.current()
    }
    el.addEventListener('cancel', onCancel)
    el.addEventListener('close', onNativeClose)
    return () => {
      el.removeEventListener('cancel', onCancel)
      el.removeEventListener('close', onNativeClose)
      mountedRef.current = false
      // deferred so StrictMode's simulated remount doesn't close the dialog
      queueMicrotask(() => {
        if (!mountedRef.current && el.open) el.close()
      })
    }
  }, [el])

  return (
    <dialog
      ref={setEl}
      aria-labelledby={titleId}
      className={floating ? `${classes.dialog} ${classes.floating}` : classes.dialog}
      style={floating ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      onPointerDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (closeOnBackdrop && pressOnBackdrop.current && e.target === e.currentTarget) onClose()
      }}
    >
      <DialogPortalContext.Provider value={el}>
        {opened && (
          <div className={classes.inner}>
            <Group
              justify="space-between"
              wrap="nowrap"
              className={floating ? classes.handle : undefined}
              onPointerDown={
                floating
                  ? (e) => {
                      if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
                      e.currentTarget.setPointerCapture?.(e.pointerId)
                      dragFrom.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
                    }
                  : undefined
              }
              onPointerMove={
                floating
                  ? (e) => {
                      const d = dragFrom.current
                      if (d) setOffset({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })
                    }
                  : undefined
              }
              onPointerUp={
                floating
                  ? () => {
                      dragFrom.current = null
                    }
                  : undefined
              }
            >
              <Text fw={600} size="sm" id={titleId}>
                {title}
              </Text>
              <ActionIcon variant="subtle" color="gray" aria-label="Закрыть" onClick={onClose}>
                <IconX size={14} />
              </ActionIcon>
            </Group>
            {children}
            {footer && <Group justify="flex-end">{footer}</Group>}
          </div>
        )}
      </DialogPortalContext.Provider>
    </dialog>
  )
}
