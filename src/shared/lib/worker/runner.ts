import type { RasterImage } from '@/shared/lib/image'
import {
  handleRequest,
  type ConvolveParams,
  type JobOp,
  type ResizeParams,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol'

/** Independent job queues: a newer preview never supersedes an apply or a resize. */
export type JobLane = 'preview' | 'apply' | 'resize'

/** Runs image jobs; resolves null when a newer job in the same lane superseded this one. */
export interface JobRunner {
  convolve(source: RasterImage, params: ConvolveParams, lane?: JobLane): Promise<RasterImage | null>
  resize(source: RasterImage, params: ResizeParams): Promise<RasterImage | null>
}

const keys = new WeakMap<RasterImage, string>()
let keyCounter = 0
function keyFor(img: RasterImage): string {
  let k = keys.get(img)
  if (!k) {
    k = `img-${++keyCounter}`
    keys.set(img, k)
  }
  return k
}

interface Port {
  post(msg: WorkerRequest, transfer: ArrayBuffer[]): void
  onReply(cb: (msg: WorkerResponse) => void): void
}

interface Job {
  source: RasterImage
  op: JobOp
  resolve: (r: RasterImage | null) => void
  reject: (e: Error) => void
}

interface LaneState {
  running: boolean
  /** At most one waiting job; a newer one replaces it (the replaced one resolves null). */
  pending: Job | null
}

/**
 * Shared logic: source sent once per image (as a transferred copy); per lane one job runs and one waits,
 * so intermediate preview requests are dropped before they are computed.
 */
export function createRunner(
  port: Port,
): JobRunner & { sentSources: () => number; computed: () => number } {
  let sentKey: string | null = null
  let sent = 0
  let computed = 0
  let jobSeq = 0
  const inflight = new Map<number, { job: Job; lane: JobLane }>()
  const lanes: Record<JobLane, LaneState> = {
    preview: { running: false, pending: null },
    apply: { running: false, pending: null },
    resize: { running: false, pending: null },
  }

  function start(lane: JobLane, job: Job) {
    const key = keyFor(job.source)
    if (key !== sentKey) {
      const copy = job.source.data.slice()
      port.post(
        {
          type: 'setSource',
          key,
          width: job.source.width,
          height: job.source.height,
          buffer: copy.buffer,
        },
        [copy.buffer],
      )
      sentKey = key
      sent++
    }
    const jobId = ++jobSeq
    lanes[lane].running = true
    inflight.set(jobId, { job, lane })
    computed++
    port.post({ type: 'run', jobId, key, op: job.op }, [])
  }

  port.onReply((msg) => {
    const entry = inflight.get(msg.jobId)
    if (!entry) return
    inflight.delete(msg.jobId)
    const state = lanes[entry.lane]
    state.running = false
    const next = state.pending
    state.pending = null
    // a newer request of the same lane is waiting: this result is stale
    if (next) {
      entry.job.resolve(null)
      start(entry.lane, next)
      return
    }
    if (msg.type === 'error') entry.job.reject(new Error(msg.message))
    else
      entry.job.resolve({
        width: msg.width,
        height: msg.height,
        data: new Uint8ClampedArray(msg.buffer),
      })
  })

  function enqueue(lane: JobLane, source: RasterImage, op: JobOp): Promise<RasterImage | null> {
    return new Promise((resolve, reject) => {
      const job: Job = { source, op, resolve, reject }
      const state = lanes[lane]
      if (!state.running) return start(lane, job)
      state.pending?.resolve(null)
      state.pending = job
    })
  }

  return {
    sentSources: () => sent,
    computed: () => computed,
    convolve(source, params, lane = 'preview') {
      return enqueue(lane, source, { kind: 'convolve', params })
    },
    resize(source, params) {
      return enqueue('resize', source, { kind: 'resize', params })
    },
  }
}

/** Same protocol on the current thread (tests, environments without Worker). Replies asynchronously. */
export function createInProcessRunner() {
  const cache = new Map<string, RasterImage>()
  let listener: (m: WorkerResponse) => void = () => {}
  return createRunner({
    post(msg) {
      const { reply } = handleRequest(msg, cache)
      if (reply) queueMicrotask(() => listener(reply))
    },
    onReply(cb) {
      listener = cb
    },
  })
}

export function createWorkerRunner(): JobRunner {
  const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' })
  return createRunner({
    post: (msg, transfer) => worker.postMessage(msg, transfer),
    onReply: (cb) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => cb(e.data)
    },
  })
}

let shared: JobRunner | null = null
/** App-wide runner: Web Worker when available, otherwise in-process. */
export function getRunner(): JobRunner {
  if (!shared)
    shared = typeof Worker === 'undefined' ? createInProcessRunner() : createWorkerRunner()
  return shared
}

export function setRunnerForTests(r: JobRunner | null): void {
  shared = r
}
