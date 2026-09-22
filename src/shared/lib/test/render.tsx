import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { theme } from '@/shared/config'

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} env="test" forceColorScheme="dark">
      <Notifications />
      {children}
    </MantineProvider>
  )
}

/** Render UI under the same providers as the app (dark, test env). */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions): RenderResult {
  return render(ui, { wrapper: Providers, ...options })
}
