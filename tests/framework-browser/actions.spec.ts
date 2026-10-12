import { test, expect } from '@playwright/test';
import { ScenarioContext } from '../../framework/runtime/scenario-context.js';
import { ApiClient } from '../../framework/clients/api-client.js';
import { readEnvironment } from '../../config/environments.js';
import { executeScenario } from '../../framework/yaml/interpreter.js';
import type { Scenario } from '../../framework/types/scenario.js';

test('browser actions, retryable assertions, and exact method mocks execute together', async ({
  page,
  request,
}) => {
  const environment = readEnvironment({});
  const context = new ScenarioContext(
    environment,
    'frontend-mocked',
    new ApiClient(request, environment, 1000),
  );
  await context.attachPage(page);
  await page.route('http://127.0.0.1:4173/login', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<input data-testid="email"><input data-testid="check" type="checkbox"><select data-testid="select"><option value="one">One</option><option value="two">Two</option></select><button data-testid="submit" onclick="fetch('/api/login', {method:'POST'}).then(r=>r.json()).then(x=>document.querySelector('h1').textContent=x.message)">Login</button><button data-testid="disabled" disabled>Disabled</button><h1 data-testid="result">Ready</h1><div data-testid="hidden" hidden>Hidden</div>`,
    }),
  );
  const scenario: Scenario = {
    schemaVersion: 1,
    id: 'ENGINE-BROWSER',
    title: 'Browser engine',
    type: 'frontend',
    modes: ['frontend-mocked'],
    tags: [],
    steps: [
      {
        action: 'mock.api',
        url: '/api/login',
        method: 'POST',
        status: 200,
        body: { message: 'Welcome' },
        delay: 10,
      },
      { action: 'ui.navigate', path: '/login' },
      { action: 'ui.fill', target: { testId: 'email' }, value: 'qa@example.test' },
      { action: 'ui.press', target: { testId: 'email' }, key: 'Tab' },
      { action: 'ui.select', target: { testId: 'select' }, value: 'two' },
      { action: 'ui.check', target: { testId: 'check' } },
      { action: 'ui.uncheck', target: { testId: 'check' } },
      { action: 'assert.visible', target: { testId: 'result' } },
      { action: 'assert.hidden', target: { testId: 'hidden' } },
      { action: 'assert.enabled', target: { testId: 'submit' } },
      { action: 'assert.disabled', target: { testId: 'disabled' } },
      { action: 'assert.count', target: { role: 'heading', name: 'Ready' }, equals: 1 },
      { action: 'assert.url', equals: '/login' },
      { action: 'assert.url', contains: '/login' },
      { action: 'ui.click', target: { role: 'button', name: 'Login' } },
      { action: 'assert.text', target: { testId: 'result' }, equals: 'Welcome' },
      { action: 'assert.text', target: { testId: 'result' }, contains: 'Wel' },
    ],
  };
  await executeScenario(scenario, context, 'browser-engine.yaml');
  await expect(page.getByTestId('email')).toHaveValue('qa@example.test');
  await expect(page.getByTestId('select')).toHaveValue('two');
  await expect(page.getByTestId('check')).not.toBeChecked();
  await context.dispose();
  await context.disposeBrowser();
});
