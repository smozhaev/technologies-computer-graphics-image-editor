import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())

// Mantine needs these browser APIs that jsdom lacks
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const originalGetComputedStyle = window.getComputedStyle
window.getComputedStyle = (elt: Element) => originalGetComputedStyle(elt)

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve(), addEventListener: vi.fn(), removeEventListener: vi.fn() },
  })
}

// ImageData is missing in jsdom
if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataPolyfill {
    readonly width: number
    readonly height: number
    readonly data: Uint8ClampedArray
    readonly colorSpace = 'srgb'
    constructor(a: number | Uint8ClampedArray, b: number, c?: number) {
      if (typeof a === 'number') {
        this.width = a
        this.height = b
        this.data = new Uint8ClampedArray(a * b * 4)
      } else {
        this.data = a
        this.width = b
        this.height = c ?? a.length / 4 / b
      }
    }
  }
  globalThis.ImageData = ImageDataPolyfill as unknown as typeof ImageData
}

// canvas: jsdom returns null from getContext without the native canvas package
HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
  return {
    canvas: this,
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => new ImageData(w, h)),
  }
}) as unknown as HTMLCanvasElement['getContext']

if (!HTMLCanvasElement.prototype.toBlob || !globalThis.Blob) {
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, type?: string) {
    cb(new Blob([], { type: type ?? 'image/png' }))
  }
}

// <dialog>: jsdom lacks showModal/show/close
const dialogProto = HTMLDialogElement.prototype
if (!dialogProto.showModal) {
  dialogProto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (!dialogProto.show) {
  dialogProto.show = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (!dialogProto.close) {
  dialogProto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

// Node's URL.createObjectURL exists but rejects jsdom Blobs, so always stub
let blobUrlCounter = 0
URL.createObjectURL = vi.fn(() => `blob:mock/${++blobUrlCounter}`)
URL.revokeObjectURL = vi.fn()

if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

if (typeof globalThis.createImageBitmap === 'undefined') {
  globalThis.createImageBitmap = vi.fn(async () => ({
    width: 1,
    height: 1,
    close: vi.fn(),
  })) as unknown as typeof createImageBitmap
}
