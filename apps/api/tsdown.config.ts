import { defineConfig } from 'tsdown'

/**
 * Build config for the API server.
 *
 * The output is a self-contained bundle: `deps.alwaysBundle` inlines every
 * runtime dependency so `build/` can run without a `node_modules` directory
 * (e.g. slim production images).
 *
 * Constraints for contributors:
 * - Dependencies that ship native addons or spawn binaries (sharp, bcrypt,
 *   better-sqlite3, esbuild, ...) cannot be inlined and must be externalized
 *   via `deps.neverBundle`, which requires shipping their files separately.
 * - Worker scripts resolved from `__dirname` at runtime cannot be bundled.
 *   `src/config/logger.ts` therefore uses `pino-pretty` as an in-process
 *   stream instead of pino's worker `transport`.
 * - Dynamic imports (e.g. `pino-pretty`) produce separate chunks, so deploy
 *   the whole `build/` directory, not just `index.mjs`.
 */
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
