import { test, expect } from '../../../framework/fixtures/test-fixtures.js';

test('[TS-JOURNEY] provision, log in, and verify the same user through API', async ({
  page,
  scenarioContext,
  authentication,
}) => {
  const email = scenarioContext.data.generate('email');
  const password = scenarioContext.data.generate('string');
  await scenarioContext.data.create('test-users', { email, password }, 'test-admin');
  await authentication.loginInBrowser('created-user', page, async (page) => {
    await page.goto('/login');
    await page.getByTestId('email-input').fill(email);
    await page.getByTestId('password-input').fill(password);
    await page.getByTestId('login-button').click();
    await expect(page.getByTestId('profile-email')).toHaveText(email);
  });
  const response = await scenarioContext.api.send({
    method: 'GET',
    path: '/api/users/me',
    auth: 'created-user',
  });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ email });
});
