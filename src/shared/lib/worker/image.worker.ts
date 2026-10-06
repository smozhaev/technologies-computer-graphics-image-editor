import type { RasterImage } from '@/shared/lib/image'
import { handleRequest, type WorkerRequest } from './protocol'

const cache = new Map<string, RasterImage>()
const scope = self as unknown as Worker

scope.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { reply, transfer } = handleRequest(e.data, cache)
  if (reply) scope.postMessage(reply, transfer)
}
