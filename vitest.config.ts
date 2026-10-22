import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@deploylens/api-client': path.resolve(__dirname, 'packages/api-client/src'),
      '@deploylens/store': path.resolve(__dirname, 'packages/store/src'),
      '@deploylens/reporting': path.resolve(__dirname, 'packages/reporting/src'),
      '@deploylens/utils': path.resolve(__dirname, 'packages/utils/src'),
      '@deploylens/config': path.resolve(__dirname, 'packages/config/src'),
      '@deploylens/contracts': path.resolve(__dirname, 'packages/contracts/src'),
      '@deploylens/rules': path.resolve(__dirname, 'packages/rules/src'),
      '@deploylens/store-guidance': path.resolve(__dirname, 'packages/store-guidance/src'),
      '@deploylens/android': path.resolve(__dirname, 'packages/android/src'),
      '@deploylens/ios': path.resolve(__dirname, 'packages/ios/src'),
      '@deploylens/core': path.resolve(__dirname, 'packages/core/src'),
      '@deploylens/ui-web': path.resolve(__dirname, 'packages/ui-web/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
});
