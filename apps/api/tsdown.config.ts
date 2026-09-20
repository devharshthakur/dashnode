import { defineConfig } from 'tsdown'

/**
 * Build config for the API server.
 *
 * The output is a self-contained bundle: `deps.alwaysBundle` inlines every
 * runtime dependency so `build/` can run with no `node_modules` directory
 * present (useful for slim production images).
 *
 * Caveat: `pino-pretty` is loaded by pino as a *string* transport at runtime,
 * so it cannot be bundled. Run the built artifact with `NODE_ENV=production`
 * to skip that transport — see `src/config/logger.ts`.
 *
 * Note: the bundle is emitted as multiple chunks (dynamic imports create
 * shared chunks), so deploy the whole `build/` directory, not just
 * `index.mjs`.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'build',
  platform: 'node',
  format: 'esm',
  sourcemap: false,
  clean: true,
  dts: false,
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
