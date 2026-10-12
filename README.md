# Standalone hybrid E2E framework

A separate black-box testing repository for one application, using TypeScript,
Playwright Test, and declarative YAML.

## Implementation status

Phase 1 implements the repository foundation: strict TypeScript, typed ESLint,
Prettier, four Playwright projects, environment configuration, URL validation,
and browser-free configuration tests. Phase 2 adds typed models, strict YAML schemas,
discovery, parsing, duplicate-ID validation, and contract tests. Phase 3 adds the
execution engine, all action handlers, variables, shared fixtures, and Playwright
registration. Phase 6 provides an executable local demo and examples in both formats
across all four projects. `npm test` starts the demo, runs the suites, and stops it.
No external credentials are needed. Phase 4 adds mocked-mode traffic isolation,
live/journey guards, and four-mode verification. Full authentication/data lifecycle
fixtures are implemented in Phase 5. CI workflows and reporting are in Phase 7. See
[authentication and owned data](docs/authentication-and-data.md) for configuration
and the required application test-data API contract.

See [implementation progress](docs/implementation-progress.md) for the ordered plan.
See [getting started](docs/getting-started.md) for the demo quick start.

## Install and verify the foundation

Use Node.js 24 LTS and npm 11. Package versions are pinned in `package.json` and
the dependency graph is captured in `package-lock.json`.

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run validate
npm run test:unit
```

No browser installation or application credentials are needed for these checks.
See the [YAML authoring contract](docs/yaml-authoring.md) to create and validate definitions.
For the engine browser integration check, run `npx playwright install chromium`
then `npm run test:engine`. This test supplies its own browser page and HTTP mocks.
Run `npm run test:modes` to verify YAML and native tests in all four projects against
the self-contained framework harness. See [test modes and isolation](docs/test-modes.md).
Copy `.env.example` to `.env` when configuring targets. Shell variables take
precedence over `.env` values. Never commit credentials.

## Configuration

`TEST_ENV` accepts `local-demo` (default), `development`, or `staging`.
Local demo is fixed to `http://127.0.0.1:4173`; `npm test` starts and stops it automatically.
External environments require all of `FRONTEND_BASE_URL`, `API_BASE_URL`, and
`ALLOWED_TARGET_HOSTS`. URLs must be HTTP(S) origins without embedded credentials.
The host allowlist contains exact hosts, including non-default ports when used.
No production environment is supported. Operators must ensure allowlisted hosts
actually belong to non-production systems; a label cannot prove that fact.

`BROWSER` accepts `chromium`, `firefox`, or `webkit`. `WORKERS`, `RETRIES`,
`TEST_TIMEOUT_MS`, and `REQUEST_TIMEOUT_MS` accept integers. Local defaults are
4 workers and no retries; CI defaults are 2 workers and 2 retries. The request
timeout will be consumed by the API client in Phase 3.

## Test organization

- `config/`: runtime, environment, and project configuration.
- `framework/runtime/`: same-origin target URL resolution.
- `tests/framework-unit/`: framework checks using Playwright without browser fixtures.
- `tests/typescript/{frontend,backend,journeys}/`: native test locations as tests are added.
- `tests/yaml/{frontend,backend,journeys}/register.spec.ts`: reserved discovery entry points implemented with the YAML engine.

Frontend specs must explicitly use `@frontend-mocked` and/or `@frontend-live` tags.
Both tags intentionally execute a compatible scenario in both projects. Backend
and journey specs use distinct directory matching. Backend tests must request API
fixtures only; Playwright's browser fixture is lazy. Unit tests use their own config
and never load target environment credentials.

## Suite commands

```sh
npm run test:list
npm run test:frontend:mock
npm run test:frontend:live
npm run test:backend
npm run test:journeys
npm test
npm run report
```

E2E configuration emits HTML, JUnit XML, and JSON reports, plus failure screenshots
and retained failure traces. Generated artifacts are ignored by Git. Traces can
contain sensitive application content; use synthetic accounts and restrict artifact
access. Secret redaction and authentication boundaries remain later-phase work.

Run `npm run audit` for dependency vulnerability findings and `npm run licenses`
for installed dependency metadata, including declared licenses where supplied.

## Dependency choices

Registry versions were checked during implementation. TypeScript 6.0.3 is pinned
because typescript-eslint 8.71.1 supports TypeScript versions below 6.1, whereas
the registry's latest TypeScript is 7.0.2. Playwright is 1.64.0, ESLint 10.12.0,
Prettier 3.9.10, YAML 2.9.1, and Ajv 8.20.0. The exact full set is in package.json.
Node 24 is an LTS line in the [official release schedule](https://github.com/nodejs/Release).
Project configuration follows [Playwright projects](https://playwright.dev/docs/test-projects).
