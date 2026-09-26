import { createContext, useContext } from 'react'

/** The <dialog> element of the nearest NativeDialog, or null outside a dialog. */
export const DialogPortalContext = createContext<HTMLElement | null>(null)

/** Portal target for Mantine dropdowns inside a modal dialog (top layer). */
export function useDialogPortalTarget(): HTMLElement | undefined {
  return useContext(DialogPortalContext) ?? undefined
}
