import { useMemo } from 'react'

interface HistogramProps {
  bins: Uint32Array
  log: boolean
  height?: number
}

/** Bar chart of counts per level, own SVG; linear or logarithmic Y. */
export function Histogram({ bins, log, height = 120 }: HistogramProps) {
  const path = useMemo(() => {
    const scaled = Array.from(bins, (c) => (log ? Math.log1p(c) : c))
    const max = Math.max(1, ...scaled)
    let d = ''
    scaled.forEach((v, i) => {
      if (v <= 0) return
      const h = (v / max) * height
      d += `M${i} ${height}V${(height - h).toFixed(2)}h1V${height}Z`
    })
    return d
  }, [bins, log, height])
  return (
    <svg
      role="img"
      aria-label={`Гистограмма (${log ? 'логарифмическая' : 'линейная'} шкала)`}
      viewBox={`0 0 ${bins.length} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      style={{ display: 'block', background: 'var(--mantine-color-dark-8)' }}
    >
      <path d={path} fill="var(--mantine-color-gray-4)" shapeRendering="crispEdges" />
    </svg>
  )
}
