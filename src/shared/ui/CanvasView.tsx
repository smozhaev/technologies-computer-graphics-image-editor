import { useEffect, useRef, type CSSProperties } from 'react'
import type { RasterImage } from '@/shared/lib/image'

interface CanvasViewProps {
  /** Raster of exactly the backing-store size; null → nothing drawn. */
  raster: RasterImage | null
  /** CSS size of the canvas; equals raster size / dpr, never a scale factor. */
  cssWidth: number
  cssHeight: number
  className?: string
  style?: CSSProperties
}

/** Output-only canvas: one putImageData per animation frame with the latest raster. */
export function CanvasView({ raster, cssWidth, cssHeight, className, style }: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef<RasterImage | null>(null)
  const drawn = useRef<RasterImage | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    latest.current = raster
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const r = latest.current
      const canvas = canvasRef.current
      if (!r || !canvas || r.width === 0 || r.height === 0 || r === drawn.current) return
      if (canvas.width !== r.width) canvas.width = r.width
      if (canvas.height !== r.height) canvas.height = r.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.putImageData(new ImageData(r.data, r.width, r.height), 0, 0)
      drawn.current = r
    })
  }, [raster])

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    },
    [],
  )

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        display: 'block',
        width: `${cssWidth}px`,
        height: `${cssHeight}px`,
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  )
}
