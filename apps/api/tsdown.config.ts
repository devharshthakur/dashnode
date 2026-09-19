import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'build',
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  clean: true,
  dts: false,
})
