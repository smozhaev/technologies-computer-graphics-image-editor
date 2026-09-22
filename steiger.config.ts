import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // one page and small slices are expected in a course project
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // tests may reach into slice internals (spies, mocks) and neighbouring slices
    files: ['./src/**/*.test.ts', './src/**/*.test.tsx'],
    rules: {
      'fsd/no-public-api-sidestep': 'off',
      'fsd/forbidden-imports': 'off',
    },
  },
])
