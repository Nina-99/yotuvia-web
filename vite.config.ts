import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

// yotuvia-core is a local, versioned package consumed from its build output.
// Aliasing to the source repo's `dist` keeps web and mobile on the same
// artifact and avoids relying on the symlinked node_modules copy.
const coreDist = fileURLToPath(new URL('../yotuvia-core/dist', import.meta.url))
const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const coreRoot = fileURLToPath(new URL('../yotuvia-core', import.meta.url))

// `yotuvia-core` reads runtime config from `process.env.YOTUVIA_*`
// (see yotuvia-core/src/data/sources/config.ts). `process` does not exist in the
// browser, so the host shell must substitute every key at build time. Empty
// strings let the core's own `|| <default>` fallbacks apply.
const CORE_ENV_KEYS = [
  'YOTUVIA_API_URL',
  'YOTUVIA_USE_MOCKS',
  'YOTUVIA_TERMS_URL',
  'YOTUVIA_PRIVACY_URL',
] as const

// Default to the same-origin `/api` path so the browser goes through this
// server's proxy (Vite in dev, a reverse proxy in production) instead of
// hitting the API on another origin. Calling the API cross-origin triggers a
// CORS preflight, which the browser blocks when the API does not answer it.
const CORE_ENV_DEFAULTS: Record<string, string> = {
  YOTUVIA_API_URL: '/api',
}

// Stable vendor groups. Pinning these to their own chunks does NOT reduce the
// total bytes downloaded — it keeps their content hashes stable across app
// deploys (so returning users reuse the cached copy) and lets the browser
// fetch/parse them in parallel with the app shell.
const VENDOR_CHUNKS: ReadonlyArray<{ name: string; packages: readonly string[] }> = [
  { name: 'react', packages: ['react', 'react-dom', 'scheduler', 'use-sync-external-store'] },
  { name: 'router', packages: ['react-router', 'react-router-dom'] },
  { name: 'query', packages: ['@tanstack/react-query', '@tanstack/query-core'] },
  { name: 'i18n', packages: ['i18next', 'react-i18next'] },
  { name: 'zod', packages: ['zod'] },
]

/** Match `node_modules/<pkg>/` exactly, so `react` never swallows `react-router`. */
function vendorChunkFor(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/')
  if (!normalized.includes('/node_modules/')) return undefined

  for (const group of VENDOR_CHUNKS) {
    for (const pkg of group.packages) {
      if (normalized.includes(`/node_modules/${pkg}/`)) return `vendor-${group.name}`
    }
  }
  return undefined
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const readEnv = (key: string): string => env[key] ?? process.env[key] ?? ''

  // Bundle analysis is opt-in (`bun run analyze`) and never part of a normal
  // build: the visualizer only serializes build stats to `dist/`, it emits no
  // runtime code. Both a machine-readable JSON and a treemap HTML are produced.
  const analyze = readEnv('ANALYZE') === '1'
  const analyzePlugins = analyze
    ? [
        visualizer({
          filename: 'dist/bundle-stats.json',
          template: 'raw-data',
          gzipSize: true,
        }),
        visualizer({
          filename: 'dist/bundle-stats.html',
          template: 'treemap',
          gzipSize: true,
        }),
      ]
    : []

  const define = Object.fromEntries(
    CORE_ENV_KEYS.map((key) => [
      `process.env.${key}`,
      JSON.stringify(readEnv(key) || CORE_ENV_DEFAULTS[key] || ''),
    ]),
  )

  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
      tailwindcss(),
      ...analyzePlugins,
    ],
    define,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        'yotuvia-core': coreDist,
      },
    },
    build: {
      // Dev-only: emit the chunk manifest during `bun run analyze` so the
      // first-paint payload can be computed from the real import graph.
      manifest: analyze,
      rollupOptions: {
        output: {
          manualChunks: vendorChunkFor,
        },
      },
    },
    server: {
      // The aliased core lives outside this project root, so the dev server
      // must be allowed to serve it.
      fs: {
        allow: [projectRoot, coreRoot],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        // `imageUrl()` emits same-origin `/uploads/...` paths (see
        // CORE_ENV_DEFAULTS above), so the browser asks THIS server for the
        // files. Without this entry Vite answers `index.html` (200
        // text/html), the browser fails to decode it as an image, and every
        // persisted photo renders as a black box in dev.
        '/uploads': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
