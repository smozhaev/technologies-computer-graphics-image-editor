import {
  convolve3x3,
  resizeImage,
  type FilterChannels,
  type InterpolatorId,
  type Kernel,
  type PaddingMode,
  type RasterImage,
} from '@/shared/lib/image'

export interface ConvolveParams {
  kernel: Kernel
  channels: FilterChannels
  mode: PaddingMode
  levelMax: 127 | 255
}

export interface ResizeParams {
  width: number
  height: number
  method: InterpolatorId
  levelMax: 127 | 255
}

export type JobOp =
  { kind: 'convolve'; params: ConvolveParams } | { kind: 'resize'; params: ResizeParams }

export type WorkerRequest =
  | { type: 'setSource'; key: string; width: number; height: number; buffer: ArrayBuffer }
  | { type: 'run'; jobId: number; key: string; op: JobOp }

export type WorkerResponse =
  | { type: 'result'; jobId: number; width: number; height: number; buffer: ArrayBuffer }
  | { type: 'error'; jobId: number; message: string }

function runOp(src: RasterImage, op: JobOp): RasterImage {
  if (op.kind === 'convolve') {
    const { kernel, channels, mode, levelMax } = op.params
    return convolve3x3(src, kernel, channels, mode, levelMax)
  }
  const { width, height, method, levelMax } = op.params
  return resizeImage(src, width, height, method, levelMax)
}

/** Pure dispatcher used by the worker; returns the reply and buffers to transfer. */
export function handleRequest(
  msg: WorkerRequest,
  cache: Map<string, RasterImage>,
): { reply: WorkerResponse | null; transfer: ArrayBuffer[] } {
  if (msg.type === 'setSource') {
    cache.clear()
    cache.set(msg.key, {
      width: msg.width,
      height: msg.height,
      data: new Uint8ClampedArray(msg.buffer),
    })
    return { reply: null, transfer: [] }
  }
  const src = cache.get(msg.key)
  if (!src) {
    return {
      reply: { type: 'error', jobId: msg.jobId, message: 'Нет исходного изображения' },
      transfer: [],
    }
  }
  try {
    const out = runOp(src, msg.op)
    const buffer = out.data.buffer
    return {
      reply: { type: 'result', jobId: msg.jobId, width: out.width, height: out.height, buffer },
      transfer: [buffer],
    }
  } catch (e) {
    const message =
      e instanceof RangeError ? 'Недостаточно памяти' : e instanceof Error ? e.message : String(e)
    return { reply: { type: 'error', jobId: msg.jobId, message }, transfer: [] }
  }
}
