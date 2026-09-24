/** Browser codec / IO failure with a Russian user-facing message. */
export class BrowserImageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'BrowserImageError'
  }
}
