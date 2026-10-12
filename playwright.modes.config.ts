import { defineConfig } from '@playwright/test';
import { createProjects } from './config/test-projects.js';
import { readRuntime } from './config/runtime.js';
import { targetEnvironment } from './tests/mode-integration/environment.js';

export default defineConfig({
  testDir: './tests/mode-integration',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 15_000,
  reporter: [['list']],
  outputDir: 'test-results/modes',
  projects: createProjects(targetEnvironment, readRuntime({}), 'tests/mode-integration'),
  webServer: {
    command: 'npx tsx tests/mode-integration/server.ts',
    url: 'http://127.0.0.1:4187/health',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
