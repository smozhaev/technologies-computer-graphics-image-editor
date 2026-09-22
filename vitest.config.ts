import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: { provider: 'v8' },
      projects: [
        {
          extends: true,
          test: {
            name: 'core',
            include: ['src/shared/lib/image/**/*.test.ts'],
            environment: 'node',
          },
        },
        {
          extends: true,
          test: {
            name: 'ui',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: [...configDefaults.exclude, 'src/shared/lib/image/**'],
            environment: 'jsdom',
            setupFiles: ['src/shared/lib/test/setup-ui.ts'],
          },
        },
      ],
    },
  }),
)
