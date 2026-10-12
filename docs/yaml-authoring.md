# YAML contract v1

Phase 3 executes validated definitions through the shared Playwright runner.
Run `npm run validate` or `npm run validate -- path/to/scenarios` before execution.
The validator recursively reads `.yaml` and `.yml` files in deterministic order,
validates each file, and checks IDs across the entire supplied directory. Missing
directories, empty collections, and duplicate IDs fail validation.

Each file contains exactly one scenario. Required fields are `schemaVersion: 1`,
`id`, `title`, `type`, `tags`, and a nonempty `steps` array. IDs are case-sensitive,
start with a letter, and contain letters, digits, underscores, or hyphens (128
characters maximum). Categories are `frontend`, `backend`, and `journeys`.
Tags contain letters, digits, underscores, and hyphens and must be unique.

Frontend scenarios require `modes: [frontend-mocked]`, `[frontend-live]`, or both.
Other categories forbid `modes`. `mock.api` is accepted only when the scenario
is exclusively eligible for mocked frontend execution. Backend scenarios reject
browser actions. These rules apply to setup and teardown as well as main steps.

Optional scenario fields:

| Field               | Contract                                                                          |
| ------------------- | --------------------------------------------------------------------------------- |
| `description`       | Nonempty descriptive text                                                         |
| `prerequisites`     | Array of human-readable conditions; never executable expressions                  |
| `timeout`           | Positive integer milliseconds                                                     |
| `testData`          | Named JSON values for scenario input                                              |
| `browserAuth`       | Session profile applied before steps in live frontend/journeys                    |
| `setup`, `teardown` | Ordered action arrays run around main steps; teardown is attempted after failures |

Unknown fields are rejected at scenario, action, and locator levels. Each action
can include a nonempty `name`. At most 500 actions are allowed per section.

## Targets and actions

A target is exactly one of `{testId: login-button}`, `{role: button, name: Login}`,
`{label: Email}`, or `{text: Welcome}`. CSS and XPath are not part of v1.
Role values are explicitly enumerated in the JSON Schema. Text/name matching
matching uses exact locator text/name matching; avoid ambiguous locators.

| Action                              | Required parameters                                 | Optional parameters                                     |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `ui.navigate`                       | `path` (root-relative URL)                          | —                                                       |
| `ui.click`                          | `target`                                            | —                                                       |
| `ui.fill`                           | `target`, `value` (string, may be empty)            | —                                                       |
| `ui.select`                         | `target`, `value` (string or nonempty string array) | —                                                       |
| `ui.check`, `ui.uncheck`            | `target`                                            | —                                                       |
| `ui.press`                          | `target`, `key`                                     | —                                                       |
| `assert.visible`, `assert.hidden`   | `target`                                            | —                                                       |
| `assert.enabled`, `assert.disabled` | `target`                                            | —                                                       |
| `assert.text`                       | `target`, exactly one of `equals` or `contains`     | —                                                       |
| `assert.url`                        | Exactly one of `equals` or `contains`               | —                                                       |
| `assert.count`                      | `target`, `equals` (nonnegative integer)            | —                                                       |
| `api.request`                       | `method`, `path`                                    | `headers`, `query`, `body`, `auth`, `saveAs`, `timeout` |
| `assert.status`                     | `from`, `equals` (100–599)                          | —                                                       |
| `assert.json`                       | `from`, `path`, `equals` (JSON value)               | —                                                       |
| `assert.header`                     | `from`, `header`, `equals` (string)                 | —                                                       |
| `assert.responseTime`               | `from`, `lessThan` (positive milliseconds)          | —                                                       |
| `mock.api`                          | `url`, `method`, `status` (100–599)                 | `body`, `headers`, `delay` (0–30000 ms)                 |
| `data.generate`                     | `kind` (`uuid`, `email`, `string`), `saveAs`        | `prefix` (up to 64 letters/digits/underscores/hyphens)  |
| `data.create`                       | `resource`, JSON-object `body`, `saveAs`            | `auth`                                                  |

HTTP methods are GET, POST, PUT, PATCH, DELETE. Headers are string maps; query
values are strings, numbers, or booleans. Bodies accept JSON values. `auth` names
a configured authentication profile. `saveAs` and `from` start with a letter and
contain letters, digits, underscores, and hyphens.

JSON paths support `$`, `.property`, and `[0]` array indexing, combined as needed:
`$.users[0].email`. Filters, wildcards, recursive descent, quoted property names,
and executable expressions are unsupported.

Mock URLs are root-relative paths; the matcher uses exact pathname and
query matching against the configured API origin, plus the supplied method.
They are not regular expressions or globs. Delay is only for controlled mock
responses. URL origin/traversal checks remain an additional runtime boundary.

```yaml
schemaVersion: 1
id: LOGIN-MOCK-001
title: Login with a mocked backend
type: frontend
modes: [frontend-mocked]
tags: [smoke]
steps:
  - action: mock.api
    url: /api/login
    method: POST
    status: 200
    body: { authenticated: true }
  - action: ui.navigate
    path: /login
  - action: ui.fill
    target: { testId: email-input }
    value: '${TEST_EMAIL}'
  - action: ui.click
    target: { role: button, name: Login }
  - action: assert.url
    contains: /dashboard
```

This is a contract example, not a verified demo journey. The backend contract
example is in `tests/yaml/backend/current-user.yaml`. Variable-looking strings
are preserved verbatim by validation and resolved immediately before each action.
Validation does not prove a referenced response, profile, or variable exists.

## Variables and execution

Use `${TEST_EMAIL}`, `${TEST_PASSWORD}`, or `${TEST_USER_TOKEN}` for the only
allowlisted environment values. Other operating-system variables are inaccessible.
`${generated.email}` reads a `data.generate` value, `${responses.profile.body.email}`
reads a saved response body, and `${data.name}` reads scenario `testData`.
Namespaces are explicit: generated values and responses never shadow environment
names. Saved responses expose `status`, `headers`, `body`, and `durationMs`.

A whole-value reference preserves its type, such as `body: '${data.payload}'`.
Embedded references stringify scalar values; objects and arrays require whole-value
references. References resolve recursively with cycle and depth protection. Missing
values, unknown namespaces, prototype paths, and malformed references fail the step.
Action parameters are validated again after substitution. Numeric-only schema fields
currently require literal numbers; typed substitution is supported in JSON bodies and
JSON expected values. Object keys and action names should be literals.

`assert.text.equals` retries for an exact text match; `contains` retries for a substring.
`assert.url.equals` takes a root-relative path resolved against the frontend origin;
`contains` checks the full URL. API JSON assertions compare the selected value deeply.
API redirects are returned as responses without following them. The `test-user`
profile uses `TEST_USER_TOKEN`; session/login fixtures and owned-data setup are
documented in [authentication and data](authentication-and-data.md). `data.create`
enrolls records for automatic ownership-checked cleanup and exposes the result
under `${generated.<saveAs>}`. Use it only with configured dedicated test endpoints.
Direct API actions are forbidden in mocked frontend execution.

Every action appears as a `test.step` with source file, section, index, and action.
The test title preserves ID/title. Setup runs first, then main steps; all teardown
actions are attempted even if earlier actions fail. Cleanup failures are retained
alongside the primary error. A process kill or exhausted Playwright timeout can
still prevent network cleanup. Owned-record teardown is implemented; recovery after
process termination requires server-side ownership auditing or TTL policies.

Engine error messages omit handler payloads and credentials. Playwright's own API
steps, traces, screenshots, and page content may still capture sensitive data;
comprehensive artifact sanitization is not implemented in Phase 3. Use synthetic
test data and restricted artifacts. Context-wide missing-mock interception and request
isolation are implemented in Phase 4. Configure all API path prefixes for shared-origin
applications as described in [test modes](test-modes.md).

## Input limits and errors

Files are limited to 1 MiB and 64 AST nesting levels. Anchors, aliases, explicit
tags, duplicate mapping keys, multiple documents, and parser warnings are rejected.
YAML uses the core scalar schema; quote numeric-looking strings where necessary.
Discovery rejects symbolic links. JSON objects cannot use `__proto__`, `constructor`,
or `prototype` keys. No shell, script, or filesystem action exists.

Schema errors include the source file, JSON Pointer property path, and failed
rule. Parse errors include a parser code without source snippets. Instance values
are omitted to avoid disclosing credentials; filenames and property paths remain
visible, so never put secrets in those names. Fix unknown action spelling, remove
unexpected properties, and check the parameter types in the table above.

## Contract checks

`assert.contract` validates a saved response body against a named JSON Schema in
`schemas/contracts/<name>.json`. It runs only when a scenario uses it, so contracts are
optional.

```yaml
- action: assert.contract
  from: profile
  schema: user-profile-v1
```

- `schema` must match `^[a-z0-9][a-z0-9-]{0,62}$`. The file must exist and be valid JSON.
- Contracts use JSON Schema draft-07 (the Ajv default).
- A mismatch is reported as an `assertion` failure.

## Failure categories

Each failed scenario reports one or more categories:

- `assertion`: the product behaved differently from the expectation.
- `invalid-definition`: a variable could not be resolved, or an action or contract is not
  configured.
- `infrastructure`: a timeout, refused connection, or unavailable service.
- `setup-cleanup`: owned data could not be created or removed.
