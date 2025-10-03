import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'coverage/**',
        'prisma/**',
        '*.config.js',
        'src/app.js' // archivo principal del servidor
      ]
    },
    testTimeout: 30000, // 30 segundos timeout para tests con base de datos
    hookTimeout: 30000,
  },
  esbuild: {
    target: 'node18'
  }
})
