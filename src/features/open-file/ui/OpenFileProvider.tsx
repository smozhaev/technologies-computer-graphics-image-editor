import { useCallback, useRef, type ReactNode } from 'react'
import { OpenFileContext } from '../model/open-file-context'
import { openAndNotify } from '../model/open-and-notify'

/** Renders the hidden file input and exposes requestOpen() to descendants. */
export function OpenFileProvider({ children }: { children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const requestOpen = useCallback(() => inputRef.current?.click(), [])
  return (
    <OpenFileContext.Provider value={requestOpen}>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gb7"
        hidden
        data-testid="open-file-input"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void openAndNotify(file)
        }}
      />
      {children}
    </OpenFileContext.Provider>
  )
}
