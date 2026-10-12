import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { BrowserPolicy, readApiPrefixes } from '../../framework/runtime/browser-policy.js';
import type { EnvironmentConfig } from '../../config/environments.js';

test('missing handlers, method/query mismatches and popup requests never reach the backend', async ({
  browser,
}) => {
  let apiHits = 0;
  const server = createServer((request, response) => {
    if (request.url === '/jump') {
      response.writeHead(302, { location: '/middle' });
      response.end();
      return;
    }
    if (request.url === '/middle') {
      response.writeHead(302, { location: '/api/redirected' });
      response.end();
      return;
    }
    if (request.url?.startsWith('/api')) apiHits++;
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<h1>Policy harness</h1>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
  const origin = `http://${host}`;
  const environment: EnvironmentConfig = {
    name: 'local-demo',
    apiBaseURL: origin,
    frontendBaseURL: origin,
    allowedHosts: [host],
  };
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const policy = new BrowserPolicy(context, environment, 'frontend-mocked');
  try {
    await policy.install();
    policy.addMock({
      method: 'GET',
      url: '/api/value?variant=one',
      status: 200,
      body: { value: 'mock' },
    });
    const page = await context.newPage();
    await page.goto(origin);
    expect(
      await page.evaluate(
        async () => (await (await fetch('/api/value?variant=one')).json()) as unknown,
      ),
    ).toEqual({ value: 'mock' });
    for (const [path, method] of [
      ['/api/unhandled?secret=hidden', 'GET'],
      ['/api/value?variant=one', 'POST'],
      ['/api/value?variant=two', 'GET'],
      ['/jump', 'GET'],
    ]) {
      expect(
        await page.evaluate(
          async ({ path, method }) => {
            try {
              await fetch(path ?? '/', { method: method ?? 'GET' });
              return 'leaked';
            } catch {
              return 'blocked';
            }
          },
          { path, method },
        ),
      ).toBe('blocked');
    }
    const popupPromise = context.waitForEvent('page');
    await page.evaluate(() => {
      window.open('/api/popup');
    });
    const popup = await popupPromise;
    await popup.waitForLoadState().catch(() => undefined);
    expect(apiHits).toBe(0);
    expect(() => policy.assertHealthy()).toThrow('Missing mock handler');
    try {
      policy.assertHealthy();
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
    await expect(policy.dispose()).rejects.toThrow('Missing mock handler');
  } finally {
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('dedicated API origins block every unmatched path; shared origins use path segment prefixes', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const base = {
      name: 'local-demo' as const,
      frontendBaseURL: 'http://frontend.test',
      apiBaseURL: 'http://backend.test',
      allowedHosts: ['frontend.test', 'backend.test'],
    };
    const separate = new BrowserPolicy(context, base, 'frontend-mocked');
    expect(separate.isApi(new URL('http://backend.test/v1/users'))).toBe(true);
    const shared = new BrowserPolicy(
      context,
      { ...base, apiBaseURL: base.frontendBaseURL },
      'frontend-mocked',
      readApiPrefixes('/api,/graphql'),
    );
    expect(shared.isApi(new URL('http://frontend.test/api/value'))).toBe(true);
    expect(shared.isApi(new URL('http://frontend.test/graphql'))).toBe(true);
    expect(shared.isApi(new URL('http://frontend.test/apiary'))).toBe(false);
    expect(() => readApiPrefixes('https://unsafe.test')).toThrow('API_PATH_PREFIXES');
  } finally {
    await context.close();
  }
});

test('external hosts and mocked WebSockets are blocked with actionable diagnostics', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const policy = new BrowserPolicy(
    context,
    {
      name: 'local-demo',
      frontendBaseURL: 'http://127.0.0.1:4173',
      apiBaseURL: 'http://127.0.0.1:4173',
      allowedHosts: ['127.0.0.1:4173'],
    },
    'frontend-mocked',
  );
  try {
    await policy.install();
    const page = await context.newPage();
    await expect(page.goto('http://127.0.0.1:49999/not-allowed')).rejects.toThrow();
    const socketPage = await context.newPage();
    await socketPage.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const socket = new WebSocket('ws://127.0.0.1:4173/events');
          socket.onclose = () => resolve();
          socket.onerror = () => resolve();
        }),
    );
    expect(() => policy.assertHealthy()).toThrow('not allowlisted');
    expect(() => policy.assertHealthy()).toThrow('WebSocket blocked');
    await expect(policy.dispose()).rejects.toThrow();
  } finally {
    await context.close();
  }
});
