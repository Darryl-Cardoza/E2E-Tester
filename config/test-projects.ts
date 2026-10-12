import type { Project } from '@playwright/test';
import type { EnvironmentConfig } from './environments.js';
import type { readRuntime } from './runtime.js';

export const executionModes = ['frontend-mocked', 'frontend-live', 'backend', 'journeys'] as const;
export type ExecutionMode = (typeof executionModes)[number];

export function createProjects(
  environment: EnvironmentConfig,
  runtime: ReturnType<typeof readRuntime>,
  testRoot = 'tests',
): Project[] {
  return executionModes.map((mode) => {
    const category = mode.startsWith('frontend-') ? 'frontend' : mode;
    return {
      name: mode,
      testMatch: [
        `**/${testRoot}/typescript/${category}/**/*.spec.ts`,
        `**/${testRoot}/yaml/${category}/register.spec.ts`,
      ],
      ...(mode.startsWith('frontend-') ? { grep: new RegExp(`@${mode}(?=\\s|$)`) } : {}),
      metadata: { executionMode: mode, environment: environment.name },
      use: {
        baseURL: mode === 'backend' ? environment.apiBaseURL : environment.frontendBaseURL,
        browserName: runtime.browser,
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    };
  });
}
