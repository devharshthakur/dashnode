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
    // Bundle all dependencies (npm + workspace) instead of treating them as
    // external. `/.*/` also matches transitive deps that would otherwise be
    // left as dangling runtime imports, which is required for the output to
    // run without node_modules.
    alwaysBundle: [/.*/],
    // Bundling node_modules deps is intentional here, so silence tsdown's
    // "dependency was bundled" warnings rather than listing every package.
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
