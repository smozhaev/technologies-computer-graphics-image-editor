import { Center, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconPhotoPlus } from '@tabler/icons-react'
import classes from './Viewport.module.css'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasView } from '@/shared/ui'
import { composeView, sampleView, VIEW_BACKGROUND } from '@/shared/lib/image'
import { pickAt } from '@/features/pick-color'
import { zoomBy } from '@/features/zoom-view'
import { useRequestOpen } from '@/features/open-file'
import { setViewportSize, setViewScroll } from '@/entities/editor'
import { useEditor } from '@/entities/editor'

const bgCss = `rgb(${VIEW_BACKGROUND.r} ${VIEW_BACKGROUND.g} ${VIEW_BACKGROUND.b})`

/** Scroll container: spacer gives native scrollbars, sticky viewport-sized canvas shows renderView. */
export function Viewport() {
  const doc = useEditor((s) => s.doc)
  const view = useEditor((s) => s.view)
  const vp = useEditor((s) => s.viewport)
  const channels = useEditor((s) => s.channels)
  const levels = useEditor((s) => s.levelsPreview)
  const filtered = useEditor((s) => s.filterPreview)
  const interpolation = useEditor((s) => s.interpolation)
  const tool = useEditor((s) => s.activeTool)
  const containerRef = useRef<HTMLDivElement>(null)
  const requestOpen = useRequestOpen()

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () =>
      setViewportSize({
        cssWidth: el.clientWidth,
        cssHeight: el.clientHeight,
        dpr: window.devicePixelRatio || 1,
      })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    let mq: MediaQueryList | null = null
    const onDpr = () => {
      measure()
      subscribe()
    }
    const subscribe = () => {
      mq?.removeEventListener('change', onDpr)
      mq = window.matchMedia
        ? window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
        : null
      mq?.addEventListener('change', onDpr)
    }
    subscribe()
    return () => {
      ro.disconnect()
      mq?.removeEventListener('change', onDpr)
    }
  }, [])

  const image = doc ? doc.versions[doc.currentIndex]?.image : undefined

  // Ctrl/⌘ + wheel (and trackpad pinch, which arrives as ctrl+wheel) zooms around the cursor;
  // a native non-passive listener is needed to stop the browser's page zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      zoomBy(Math.exp(-delta * 0.0025), { x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // store → DOM scroll (zoom changes, new document); DOM → store goes through onScroll
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (el.scrollLeft !== view.scrollX) el.scrollLeft = view.scrollX
    if (el.scrollTop !== view.scrollY) el.scrollTop = view.scrollY
  }, [view, image])

  // expensive resample: only when the image, view, viewport, interpolation or filter preview changes
  const sample = useMemo(
    () =>
      doc && vp && vp.cssWidth > 0 && vp.cssHeight > 0
        ? sampleView(doc, view, vp, { source: filtered, interpolation })
        : null,
    // memoised by the current image reference, not the whole document
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [image, view, vp, interpolation, filtered],
  )
  // cheap point stages: channel toggles and levels preview reuse the sample
  const raster = useMemo(
    () => (sample ? composeView(sample, { channels, levels }) : null),
    [sample, channels, levels],
  )

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Холст"
      onScroll={(e) => setViewScroll(e.currentTarget.scrollLeft, e.currentTarget.scrollTop)}
      onClick={(e) => {
        if (tool !== 'eyedropper' || !vp || e.button !== 0) return
        const rect = e.currentTarget.getBoundingClientRect()
        pickAt(e.clientX - rect.left, e.clientY - rect.top, vp)
      }}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        background: bgCss,
        cursor: tool === 'eyedropper' && image ? 'crosshair' : 'default',
      }}
    >
      {!image && (
        <Center h="100%">
          <UnstyledButton className={classes.empty} onClick={requestOpen}>
            <Stack align="center" gap={6}>
              <IconPhotoPlus size={40} stroke={1.4} />
              <Text size="sm">Открыть изображение</Text>
              <Text size="xs" c="dimmed">
                Щёлкните или перетащите файл в окно · PNG, JPG, GB7
              </Text>
            </Stack>
          </UnstyledButton>
        </Center>
      )}
      {image && vp && (
        <div
          data-testid="viewport-spacer"
          style={{
            position: 'relative',
            width: Math.max(Math.ceil(image.width * view.zoom), vp.cssWidth),
            height: Math.max(Math.ceil(image.height * view.zoom), vp.cssHeight),
          }}
        >
          <CanvasView
            raster={raster}
            cssWidth={vp.cssWidth}
            cssHeight={vp.cssHeight}
            style={{ position: 'sticky', top: 0, left: 0 }}
          />
        </div>
      )}
    </div>
  )
}
