# Developer guide

Native tests import `test` and `expect` from `framework/fixtures/test-fixtures.ts`.
The `scenarioContext` fixture shares environment configuration, the API client,
variable state, and resource cleanup with YAML tests. It depends only on Playwright's
request fixture, so backend tests do not launch a browser. For browser tests request
`page`; the shared fixture attaches it and installs the traffic policy automatically.
Low-level engine tests must `await scenarioContext.attachPage(page)` and call
`disposeBrowser()` before closing their browser context.

```typescript
import { test, expect } from '../../../framework/fixtures/test-fixtures.js';

test('API status', async ({ scenarioContext }) => {
  const response = await scenarioContext.api.send({ method: 'GET', path: '/health' });
  expect(response.status).toBe(200);
});
```

Place backend tests in `tests/typescript/backend`, journeys in
`tests/typescript/journeys`, and browser tests in `tests/typescript/frontend`.
Frontend tests require `@frontend-mocked` or `@frontend-live` tags (both only when
compatible). Unit tests use a separate browser-free configuration; browser engine
checks use `playwright.engine.config.ts`.

To extend an action, update `ActionParameters`, the discriminated schema, the
appropriate registration function under `framework/actions`, and the authoring
table. `ActionRegistry.register` types the handler's parameters by action name.
Registry dispatch validates parameters with the same Ajv schema used for YAML.
Add a valid typed example and negative schema tests plus handler behavior tests.
Retain v1 compatibility or introduce a new versioned schema for breaking changes.

`executeScenario` resolves parameters then dispatches each action inside Playwright
steps. Its optional `StepRunner` permits isolated interpreter testing without
registering nested tests. `registerYamlTests` validates the entire YAML collection
before category filtering and registers at module import during discovery.

Scenario responses, variables, and cleanup callbacks are never global. Add resource
cleanup callbacks to `scenarioContext.cleanup`; they run in reverse order and all
are attempted. Use `scenarioContext.data.create` for automatic ownership-checked
cleanup. The `authentication` fixture manages separate bearer/session contexts.
See [authentication and owned data](authentication-and-data.md) for adapter contracts.

Run `npm run validate`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run test:unit`, `npm run test:engine`, `npm run test:modes`, and `npm run test:list`
for engine changes. See [mode boundaries](test-modes.md) for native test responsibilities.
