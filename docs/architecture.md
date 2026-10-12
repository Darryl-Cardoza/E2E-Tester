# Architecture

The framework is a black-box test harness. It talks to the application only through
browser-accessible URLs and HTTP APIs, and never imports application code.

## Two authoring models, one runtime

QA engineers write YAML scenarios in `tests/yaml/`. Developers write native Playwright
tests in `tests/typescript/`. Both run through the same Playwright Test runner, so they
share projects, fixtures, retries, timeouts, reporters, and artifacts.

## Pipeline

```text
Discover YAML files  ->  parse  ->  validate schema  ->  check duplicate IDs
   ->  register as Playwright tests (at discovery time)
   ->  initialize scenario context (per test, per worker)
   ->  execute actions as test.step()s  ->  assertions via Playwright expect
   ->  categorize failures  ->  reports (HTML, JUnit, JSON, scrubbed)
```

- `framework/yaml/loader.ts` finds files, rejects symlinks and oversize input.
- `framework/yaml/parser.ts` parses YAML without aliases, anchors or custom tags.
- `framework/yaml/validator.ts` checks the strict JSON Schema (`schemas/test-case.v1.schema.json`)
  with Ajv. Unknown fields are rejected.
- `framework/yaml/register-tests.ts` registers one Playwright test per scenario during
  discovery. Nothing is registered inside a running test.
- `framework/yaml/interpreter.ts` runs setup, steps, and teardown. Teardown always runs.

## Action registry

`framework/actions/registry.ts` maps each action name to one typed handler. Handlers are
grouped by area:

| Module                 | Actions                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-actions.ts`        | `ui.navigate`, `ui.click`, `ui.fill`, `ui.select`, `ui.check`, `ui.uncheck`, `ui.press`                                                                                                                        |
| `assertion-actions.ts` | `assert.visible`, `assert.hidden`, `assert.text`, `assert.url`, `assert.enabled`, `assert.disabled`, `assert.count`, `assert.status`, `assert.json`, `assert.header`, `assert.responseTime`, `assert.contract` |
| `api-actions.ts`       | `api.request`                                                                                                                                                                                                  |
| `mock-actions.ts`      | `mock.api`                                                                                                                                                                                                     |
| `data-actions.ts`      | `data.generate`, `data.create`                                                                                                                                                                                 |

Adding an action means adding its parameter type, its JSON Schema branch, and its handler.
See the [developer guide](developer-guide.md).

## Test isolation

- Each scenario has its own `ScenarioContext`: generated values, named responses, owned
  data, and browser policy.
- Authentication contexts are created per test and are never shared across workers or
  retries.
- Owned test data carries a per-scenario `testOwner` identifier. Cleanup deletes only
  records that match it.
- Variables resolve only from an explicit allowlist. The complete environment is never
  exposed to YAML.

## Browser and API execution

- `frontend-mocked`: browser traffic is intercepted. Mocks are declared per scenario with
  `mock.api`. Unmatched application API calls fail with a message naming the missing mock.
- `frontend-live`: the browser talks to the real backend. Mocks are disabled. Redirects
  and streaming responses are not supported.
- `backend`: `APIRequestContext` only. No browser is launched.
- `journeys`: real browser and real API in one test. Mocks are rejected.

Requests to hosts outside `ALLOWED_TARGET_HOSTS` are blocked.

## Failure categories

Failures are classified as `assertion`, `invalid-definition`, `infrastructure`, or
`setup-cleanup` (see `framework/reporting/failure-category.ts`). The category appears in
the error text and in a `failure-category` annotation.

## Reporting

`playwright.config.ts` writes HTML, JUnit XML, and JSON reports. Run metadata
(`framework/reporting/result-metadata.ts`) adds environment, build ID, Git commit, and
start timestamp to every report. After the run, `framework/reporting/scrub-reporter.ts`
replaces configured credentials in the text reports and failure files.

## CI/CD

Two workflows in `.github/workflows/`: `validate-tests.yml` for pull requests (no secrets)
and `manual-e2e.yml` for manually selected suites against GitHub environments. See
[CI/CD](ci-cd.md).

## Extensibility

- New YAML scenarios need no code changes.
- New action handlers are added in `framework/actions/` and registered in
  `default-registry.ts`.
- Contract schemas go in `schemas/contracts/` and are referenced by name.
- Application-specific test-data resources are configured in `config/data-resources.ts`.
