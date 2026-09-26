import { createContext, useContext } from 'react'

export const OpenFileContext = createContext<() => void>(() => {})

/** Stable function that opens the system file picker. */
export function useRequestOpen(): () => void {
  return useContext(OpenFileContext)
}
