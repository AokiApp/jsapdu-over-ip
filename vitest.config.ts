import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60 seconds for E2E tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    include: ['tests/**/*.test.ts', 'examples/**/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  },
  resolve: {
    alias: {
      '@aokiapp/jsapdu-over-ip-examples-test-utils': resolve(__dirname, 'examples/test-utils/src'),
      '@aokiapp/jsapdu-interface': resolve(__dirname, 'node_modules/@aokiapp/jsapdu-interface'),
    },
  },
});
