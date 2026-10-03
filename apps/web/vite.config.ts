import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

/**
 * Server-only variable naming the API origin; keep it in step with
 * `API_UPSTREAM_ENV_VAR` in `src/lib/server/api-upstream.server.ts`, which is the
 * module that reads it. It is not imported from there because this config is
 * evaluated before the app's modules and must not pull the server runtime in.
 */
const API_UPSTREAM_ENV_VAR = 'API_UPSTREAM_URL'

const config = defineConfig(({ mode }) => {
  // Bridge the server-only upstream into its runtime environment without
  // exposing it to the browser or overwriting a hosting platform's value.
  const env: Partial<Record<string, string>> = loadEnv(
    mode,
    import.meta.dirname,
    API_UPSTREAM_ENV_VAR,
  )
  const upstream = env[API_UPSTREAM_ENV_VAR]

  if (upstream !== undefined) {
    process.env[API_UPSTREAM_ENV_VAR] ??= upstream
  }

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      nitro({ rollupConfig: { external: [/^@sentry\//] } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})

export default config
