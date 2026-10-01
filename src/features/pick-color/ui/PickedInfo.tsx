import { Divider, Group, SimpleGrid, Text } from '@mantine/core'
import classes from './PickedInfo.module.css'
import { useEditor } from '@/entities/editor'

const f2 = (v: number) => (Object.is(Math.round(v * 100) / 100, -0) ? 0 : v).toFixed(2)

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <>
      <Text size="xs" c="dimmed">
        {k}
      </Text>
      <Text size="xs" ff="monospace" ta="right">
        {v}
      </Text>
    </>
  )
}

const hex2 = (v: number) => v.toString(16).padStart(2, '0')
const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase()

/** Last eyedropper reading: image coordinates, RGB(A), CIELAB. */
export function PickedInfo() {
  const p = useEditor((s) => s.picked)
  const tool = useEditor((s) => s.activeTool)
  if (!p) {
    return tool === 'eyedropper' ? (
      <Text size="xs" c="dimmed" mt={4}>
        Щёлкните по изображению пипеткой
      </Text>
    ) : null
  }
  return (
    <div aria-label="Пипетка" role="group">
      <Divider my={6} label="Пипетка" labelPosition="left" />
      <SimpleGrid cols={2} spacing={4} verticalSpacing={0}>
        <Row k="X" v={p.x} />
        <Row k="Y" v={p.y} />
        <Row k="R" v={p.r} />
        <Row k="G" v={p.g} />
        <Row k="B" v={p.b} />
        <Row k="Альфа" v={p.a} />
        <Row k="L*" v={f2(p.lab.L)} />
        <Row k="a*" v={f2(p.lab.a)} />
        <Row k="b*" v={f2(p.lab.b)} />
      </SimpleGrid>
      <Group gap="sm" mt={8} wrap="nowrap">
        <div className={classes.swatch} aria-label="Образец цвета" role="img">
          <div
            className={classes.half}
            style={{ background: `rgb(${p.r} ${p.g} ${p.b})` }}
            title="Без прозрачности"
          />
          <div
            className={classes.half}
            style={{ background: `rgb(${p.r} ${p.g} ${p.b} / ${(p.a / 255).toFixed(3)})` }}
            title="С учётом прозрачности"
          />
        </div>
        <Text size="sm" ff="monospace" fw={600}>
          {toHex(p.r, p.g, p.b)}
        </Text>
      </Group>
    </div>
  )
}
