import { expect } from '@playwright/test';
import type { ActionRegistry } from './registry.js';
import { locate } from './ui-actions.js';
import { readJsonPath } from '../runtime/variable-resolver.js';
import { resolveTargetURL } from '../runtime/environment-manager.js';
import { loadContract } from '../runtime/contracts.js';

export function registerAssertionActions(registry: ActionRegistry): void {
  registry.register('assert.visible', async (p, c) => {
    await expect(locate(c.page, p.target)).toBeVisible();
  });
  registry.register('assert.hidden', async (p, c) => {
    await expect(locate(c.page, p.target)).toBeHidden();
  });
  registry.register('assert.enabled', async (p, c) => {
    await expect(locate(c.page, p.target)).toBeEnabled();
  });
  registry.register('assert.disabled', async (p, c) => {
    await expect(locate(c.page, p.target)).toBeDisabled();
  });
  registry.register('assert.count', async (p, c) => {
    await expect(locate(c.page, p.target)).toHaveCount(p.equals);
  });
  registry.register('assert.text', async (p, c) => {
    if (p.equals !== undefined) await expect(locate(c.page, p.target)).toHaveText(p.equals);
    else await expect(locate(c.page, p.target)).toContainText(p.contains);
  });
  registry.register('assert.url', async (p, c) => {
    if (p.equals !== undefined)
      await expect(c.page).toHaveURL(resolveTargetURL(p.equals, 'frontend', c.environment));
    else await expect(c.page).toHaveURL((url) => url.href.includes(p.contains));
  });
  registry.register('assert.contract', (p, c) => {
    // Contract names are validated and loaded from schemas/contracts only.
    const validate = loadContract(p.schema);
    const body = c.response(p.from).body;
    expect(validate(body), `Response does not match contract ${p.schema}`).toBe(true);
    return Promise.resolve();
  });
  registry.register('assert.status', async (p, c) => {
    await Promise.resolve(expect(c.response(p.from).status).toBe(p.equals));
  });
  registry.register('assert.json', async (p, c) => {
    await Promise.resolve(expect(readJsonPath(c.response(p.from).body, p.path)).toEqual(p.equals));
  });
  registry.register('assert.header', async (p, c) => {
    await Promise.resolve(
      expect(c.response(p.from).headers[p.header.toLowerCase()]).toBe(p.equals),
    );
  });
  registry.register('assert.responseTime', async (p, c) => {
    await Promise.resolve(expect(c.response(p.from).durationMs).toBeLessThan(p.lessThan));
  });
}
