import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'build',
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: false,
  clean: true,
  dts: false,
  shims: true,
  deps: {
    // Bundle node modules as well
    alwaysBundle: [/.*/],
    // // Bundle packages
    // alwaysBundle: [/^@packages\//],
    onlyBundle: false,
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
