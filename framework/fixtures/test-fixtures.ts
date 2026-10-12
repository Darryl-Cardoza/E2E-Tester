import { test as base, expect } from '@playwright/test';
import { readEnvironment } from '../../config/environments.js';
import type { EnvironmentConfig } from '../../config/environments.js';
import { readRuntime } from '../../config/runtime.js';
import { executionModes } from '../../config/test-projects.js';
import type { ExecutionMode } from '../../config/test-projects.js';
import { ApiClient } from '../clients/api-client.js';
import { ScenarioContext } from '../runtime/scenario-context.js';
import { Authentication, readAuthProfiles, scopedCredentialEnvironment } from './auth-fixture.js';
import { VariableResolver } from '../runtime/variable-resolver.js';

export const test = base.extend<{
  scenarioContext: ScenarioContext;
  targetEnvironment: EnvironmentConfig;
  authentication: Authentication;
  browserAuthProfile: string;
}>({
  targetEnvironment: [readEnvironment(), { option: true }],
  browserAuthProfile: ['', { option: true }],
  authentication: async ({ playwright, targetEnvironment }, use, testInfo) => {
    const auth = new Authentication(
      playwright.request,
      targetEnvironment,
      testInfo.project.name as ExecutionMode,
      testInfo.project.name === 'frontend-mocked' ? {} : readAuthProfiles(targetEnvironment),
      readRuntime().requestTimeout,
    );
    try {
      await use(auth);
    } finally {
      await auth.dispose();
    }
  },
  scenarioContext: async ({ request, targetEnvironment, authentication }, use, testInfo) => {
    const mode = testInfo.project.name as ExecutionMode;
    if (!executionModes.includes(mode)) throw new Error('Unknown execution project');
    const environment = targetEnvironment;
    const api = new ApiClient(
      request,
      environment,
      readRuntime().requestTimeout,
      {},
      mode,
      authentication,
    );
    const context = new ScenarioContext(
      environment,
      mode,
      api,
      new VariableResolver(scopedCredentialEnvironment(environment)),
    );
    try {
      await use(context);
    } finally {
      await context.dispose();
    }
  },
  context: async ({ context, scenarioContext, authentication, browserAuthProfile }, use) => {
    await scenarioContext.attachBrowserContext(context);
    if (browserAuthProfile) await authentication.applyToBrowser(browserAuthProfile, context);
    try {
      await use(context);
    } finally {
      await scenarioContext.disposeBrowser();
    }
  },
  page: async ({ page, scenarioContext }, use, testInfo) => {
    if (
      testInfo.project.name.startsWith('frontend-') &&
      !testInfo.tags.includes(`@${testInfo.project.name}`)
    ) {
      throw new Error('Frontend tests must declare an explicit execution-mode tag');
    }
    await scenarioContext.attachPage(page);
    await use(page);
  },
});
export { expect };
