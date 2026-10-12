import type { Page, BrowserContext } from '@playwright/test';
import { BrowserPolicy } from './browser-policy.js';
import type { EnvironmentConfig } from '../../config/environments.js';
import type { ExecutionMode } from '../../config/test-projects.js';
import type { ApiClient, SavedResponse } from '../clients/api-client.js';
import { VariableResolver } from './variable-resolver.js';
import { TestData } from '../fixtures/data-fixture.js';
import { CategorizedError } from '../reporting/failure-category.js';

export class ScenarioContext {
  readonly responses = new Map<string, SavedResponse>();
  readonly data: TestData;
  private attachedPage: Page | undefined;
  readonly cleanup: (() => Promise<void>)[] = [];
  private policy: BrowserPolicy | undefined;
  private attachedBrowser: BrowserContext | undefined;
  constructor(
    readonly environment: EnvironmentConfig,
    readonly mode: ExecutionMode,
    readonly api: ApiClient,
    readonly variables = new VariableResolver(),
  ) {
    this.data = new TestData(api);
    this.cleanup.push(() => this.data.cleanup());
  }
  async attachBrowserContext(browser: BrowserContext): Promise<void> {
    if (this.attachedBrowser && this.attachedBrowser !== browser)
      throw new Error('A scenario cannot attach multiple browser contexts');
    if (!this.policy) {
      this.attachedBrowser = browser;
      this.policy = new BrowserPolicy(browser, this.environment, this.mode);
      await this.policy.install();
    }
  }
  async attachPage(page: Page): Promise<void> {
    if (this.mode === 'backend') throw new Error('Backend scenarios cannot attach a browser');
    await this.attachBrowserContext(page.context());
    this.attachedPage = page;
  }
  get browserPolicy(): BrowserPolicy {
    if (!this.policy) throw new Error('Attach a browser context before configuring mocks');
    return this.policy;
  }
  async disposeBrowser(): Promise<void> {
    await this.policy?.dispose();
  }
  get page(): Page {
    if (!this.attachedPage) throw new Error('This action requires a browser page');
    return this.attachedPage;
  }
  response(name: string): SavedResponse {
    const response = this.responses.get(name);
    if (!response)
      throw new Error('Named response is unavailable; execute api.request with saveAs first');
    return response;
  }
  async dispose(): Promise<void> {
    const errors: Error[] = [];
    for (const cleanup of this.cleanup.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(
          new CategorizedError(
            'setup-cleanup',
            error instanceof AggregateError ? error.message : 'Scenario resource cleanup failed',
          ),
        );
      }
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        `Scenario cleanup failed\n${errors.map((error) => error.message).join('\n')}`,
      );
  }
}
