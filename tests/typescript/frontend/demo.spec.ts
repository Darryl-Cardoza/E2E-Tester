import { test, expect } from '../../../framework/fixtures/test-fixtures.js';

test(
  '[TS-UI-MOCK] loading and empty response states',
  { tag: '@frontend-mocked' },
  async ({ page, scenarioContext }) => {
    scenarioContext.browserPolicy.addMock({
      method: 'POST',
      url: '/api/login',
      status: 200,
      body: {},
      delay: 800,
    });
    scenarioContext.browserPolicy.addMock({
      method: 'GET',
      url: '/api/users/me',
      status: 200,
      body: { email: 'mock@example.test' },
    });
    scenarioContext.browserPolicy.addMock({
      method: 'GET',
      url: '/api/items',
      status: 200,
      body: [],
    });
    await page.goto('/login');
    await page.getByTestId('email-input').fill('mock@example.test');
    await page.getByTestId('password-input').fill('synthetic-input');
    await page.getByTestId('login-button').click();
    await expect(page.getByTestId('loading')).toBeVisible();
    await expect(page.getByTestId('profile-email')).toHaveText('mock@example.test');
    await expect(page.getByTestId('loading')).toBeHidden();
    await page.getByTestId('items-button').click();
    await expect(page.getByTestId('items')).toHaveText('No items');
  },
);

test(
  '[TS-UI-LIVE] authenticated session displays dashboard',
  { tag: '@frontend-live' },
  async ({ page, authentication, scenarioContext }) => {
    await authentication.applyToBrowser('test-session', page.context());
    await page.goto('/dashboard');
    await expect(page.getByTestId('profile-email')).toHaveText(
      scenarioContext.variables.resolve('${TEST_EMAIL}') as string,
    );
  },
);
