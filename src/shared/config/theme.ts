import {
  ActionIcon,
  Button,
  Checkbox,
  ColorInput,
  createTheme,
  Menu,
  NumberInput,
  SegmentedControl,
  Select,
  Switch,
  TextInput,
  Tooltip,
} from '@mantine/core'

const xs = { defaultProps: { size: 'xs' } }

export const theme = createTheme({
  defaultRadius: 'xs',
  fontSizes: { xs: '11px', sm: '12px', md: '13px', lg: '15px', xl: '17px' },
  spacing: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  components: {
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 'md' } }),
    Button: Button.extend(xs),
    Checkbox: Checkbox.extend(xs),
    ColorInput: ColorInput.extend(xs),
    Menu: Menu.extend({ defaultProps: { shadow: 'md' } }),
    NumberInput: NumberInput.extend(xs),
    SegmentedControl: SegmentedControl.extend(xs),
    Select: Select.extend(xs),
    Switch: Switch.extend(xs),
    TextInput: TextInput.extend(xs),
    Tooltip: Tooltip.extend({ defaultProps: { openDelay: 400 } }),
  },
})
