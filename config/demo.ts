import { randomUUID } from 'node:crypto';

/** Local-only values are generated in the runner and inherited by its demo process. */
export function initializeDemoEnvironment(): void {
  process.env.LOCAL_DEMO_TEST_EMAIL ??= 'qa@example.test';
  process.env.LOCAL_DEMO_TEST_PASSWORD ??= randomUUID();
  process.env.LOCAL_DEMO_TEST_USER_TOKEN ??= randomUUID();
  process.env.LOCAL_DEMO_TEST_ADMIN_TOKEN ??= randomUUID();
  process.env.LOCAL_DEMO_TEST_EXPIRED_TOKEN ??= randomUUID();
  process.env.LOCAL_DEMO_TEST_SESSION_LOGIN_PATH = '/api/login';
}
