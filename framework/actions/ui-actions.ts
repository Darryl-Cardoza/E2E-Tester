import type { Page, Locator } from '@playwright/test';
import type { Target } from '../types/scenario.js';
import type { ActionRegistry } from './registry.js';
import { resolveTargetURL } from '../runtime/environment-manager.js';

export function locate(page: Page, target: Target): Locator {
  if ('testId' in target) return page.getByTestId(target.testId);
  if ('role' in target)
    return page.getByRole(target.role as Parameters<Page['getByRole']>[0], {
      name: target.name,
      exact: true,
    });
  if ('label' in target) return page.getByLabel(target.label, { exact: true });
  return page.getByText(target.text, { exact: true });
}
export function registerUiActions(registry: ActionRegistry): void {
  registry.register('ui.navigate', async (p, c) => {
    await c.page.goto(resolveTargetURL(p.path, 'frontend', c.environment));
  });
  registry.register('ui.click', async (p, c) => {
    await locate(c.page, p.target).click();
  });
  registry.register('ui.fill', async (p, c) => {
    await locate(c.page, p.target).fill(p.value);
  });
  registry.register('ui.select', async (p, c) => {
    await locate(c.page, p.target).selectOption(p.value);
  });
  registry.register('ui.check', async (p, c) => {
    await locate(c.page, p.target).check();
  });
  registry.register('ui.uncheck', async (p, c) => {
    await locate(c.page, p.target).uncheck();
  });
  registry.register('ui.press', async (p, c) => {
    await locate(c.page, p.target).press(p.key);
  });
}
