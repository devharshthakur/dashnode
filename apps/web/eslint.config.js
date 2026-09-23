//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import { plugin as shadcn } from '@shadcn/lint'

export default [
  ...tanstackConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { shadcn },
    rules: {
      'shadcn/no-arbitrary-values': 'error',
      'shadcn/no-restyle': ['error', { allow: ['layout'] }],
    },
  },
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'lint-staged.config.js',
      '.output',
      'dist',
      'build',
      '.nitro',
      '.tanstack',
      '.vinxi',
      'src/routeTree.gen.ts',
      'src/components/ui/**',
    ],
  },
]
