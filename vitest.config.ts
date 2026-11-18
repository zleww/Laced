import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Each database test file starts its own in-memory Postgres. Running them
    // two at a time keeps memory use modest on a laptop.
    maxWorkers: 2,
  },
})
