import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'build',
  platform: 'node',
  format: 'esm',
  sourcemap: false,
  clean: true,
  dts: false,
  deps: {
    alwaysBundle: [/^@packages\//],
  },
  outputOptions: {
    comments: false,
  },
  inputOptions: {
    experimental: {
      attachDebugInfo: 'none',
    },
  },
})
