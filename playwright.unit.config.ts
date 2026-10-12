import { defineConfig } from '@playwright/test';

// Framework validation never loads target credentials or starts a browser/server.
export default defineConfig({
  testDir: './tests/framework-unit',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 10_000,
  outputDir: 'test-results/unit',
  reporter: [['list']],
});
