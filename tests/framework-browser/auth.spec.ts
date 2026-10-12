import { test, expect } from '@playwright/test';
import { Authentication } from '../../framework/fixtures/auth-fixture.js';
import { startLifecycleServer } from '../support/lifecycle-server.js';

test('browser state rejects broad-domain cookies before reuse', async ({ browser, playwright }) => {
  const server = await startLifecycleServer();
  const auth = new Authentication(playwright.request, server.environment, 'frontend-live', {});
  const context = await browser.newContext();
  try {
    await context.addCookies([
      { name: 'unrelated', value: 'synthetic', domain: '.example.test', path: '/' },
    ]);
    const page = await context.newPage();
    await expect(auth.loginInBrowser('unsafe', page, () => Promise.resolve())).rejects.toThrow(
      'broad-domain cookie',
    );
    await expect(auth.context('unsafe')).rejects.toThrow('not configured');
  } finally {
    await context.close();
    await auth.dispose();
    await server.close();
  }
});

test('session state reaches browser; browser login state can be reused by an isolated API context', async ({
  browser,
  playwright,
}) => {
  const server = await startLifecycleServer();
  const auth = new Authentication(playwright.request, server.environment, 'frontend-live', {
    session: {
      kind: 'session',
      path: '/login',
      email: server.credentials.email,
      password: server.credentials.password,
    },
  });
  const context = await browser.newContext();
  const other = await browser.newContext();
  try {
    await auth.applyToBrowser('session', context);
    const page = await context.newPage();
    await page.goto(server.environment.frontendBaseURL + '/page');
    expect(await page.evaluate(async () => (await fetch('/me')).status)).toBe(200);
    const loginPage = await other.newPage();
    await auth.loginInBrowser('browser-session', loginPage, async (page) => {
      await page.goto(server.environment.frontendBaseURL + '/page');
      await page.evaluate(
        async (credentials) => {
          await fetch('/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(credentials),
          });
        },
        { email: server.credentials.email, password: server.credentials.password },
      );
    });
    const response = await (
      await auth.context('browser-session')
    ).get(server.environment.apiBaseURL + '/me');
    expect(response.status()).toBe(200);
    await response.dispose();
  } finally {
    await context.close();
    await other.close();
    await auth.dispose();
    await server.close();
  }
});
