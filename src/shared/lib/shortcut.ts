const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** 'Ctrl+O' or '⌘O' */
export function shortcut(key: string, shift = false, alt = false): string {
  return isMac
    ? `${alt ? '⌥' : ''}${shift ? '⇧' : ''}⌘${key}`
    : `Ctrl+${alt ? 'Alt+' : ''}${shift ? 'Shift+' : ''}${key}`
}
