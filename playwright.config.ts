import { defineConfig } from '@playwright/test';
import { readEnvironment } from './config/environments.js';
import { loadLocalEnvironment, readRuntime } from './config/runtime.js';
import { createProjects } from './config/test-projects.js';
import { initializeDemoEnvironment } from './config/demo.js';
import { scopedCredentialEnvironment } from './framework/fixtures/auth-fixture.js';
import { runMetadata } from './framework/reporting/result-metadata.js';

loadLocalEnvironment();
const environment = readEnvironment();
const runtime = readRuntime();
if (environment.name === 'local-demo') initializeDemoEnvironment();

export default defineConfig({
  testDir: './tests',
  ...(environment.name === 'local-demo'
    ? {
        webServer: {
          command: 'npx tsx demo/server.ts',
          url: 'http://127.0.0.1:4173/health',
          reuseExistingServer: false,
          timeout: 15000,
        },
      }
    : {}),
  fullyParallel: true,
  forbidOnly: runtime.ci,
  workers: runtime.workers,
  retries: runtime.retries,
  timeout: runtime.testTimeout,
  expect: { timeout: 5_000 },
  outputDir: 'test-results/e2e',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    // Must stay last: it rewrites the text reports the reporters above just wrote.
    [
      './framework/reporting/scrub-reporter.ts',
      {
        secrets: Object.entries(scopedCredentialEnvironment(environment))
          .filter(([key]) => /PASSWORD|TOKEN/.test(key))
          .map(([, value]) => value)
          .filter((value): value is string => Boolean(value)),
        files: ['test-results/junit.xml', 'test-results/results.json'],
        directories: ['test-results/e2e', 'playwright-report'],
      },
    ],
  ],
  metadata: runMetadata(environment.name, process.env.APP_BUILD_ID ?? 'unspecified'),
  use: { actionTimeout: 10_000, navigationTimeout: 15_000 },
  projects: createProjects(environment, runtime),
});
