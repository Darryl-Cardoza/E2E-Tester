import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/framework-browser',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: { browserName: 'chromium', serviceWorkers: 'block' },
  reporter: [['list']],
  outputDir: 'test-results/engine',
});
