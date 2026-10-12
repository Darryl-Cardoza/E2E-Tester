# Execution modes and isolation

All four projects use the same Playwright runner and shared fixtures. Application
suites match only `tests/typescript` and `tests/yaml`, excluding internal harnesses.

| Project           | Eligibility                | Behavior                                                                                 |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `frontend-mocked` | Frontend modes/tag         | Exact method/URL mocks; unmatched application API requests are aborted and fail the test |
| `frontend-live`   | Frontend modes/tag         | Real frontend/backend; framework mocks rejected                                          |
| `backend`         | Backend category/directory | Direct HTTP without browser dependencies                                                 |
| `journeys`        | Journey category/directory | Real browser/API interactions; framework mocks rejected                                  |

Both frontend modes execute a scenario only when explicitly eligible for both.
YAML tags cannot use reserved project names to override `modes`. Near-match native
tags such as `@frontend-live-extra` do not select live mode. Native authors must
declare actual tags rather than put mode tokens in titles; fixtures check tags.

The shared context fixture installs routing before page creation, covering popups
and all pages in the context. Project configuration blocks service workers. Mocks
are scenario-local and policy cleanup runs before context closure. Native authors
register mocks through `scenarioContext.browserPolicy.addMock`, never direct
Playwright routes for application APIs, which can override this boundary.

Separate frontend/API origins treat every path on the API origin as backend traffic.
For a shared origin, `API_PATH_PREFIXES` defaults to `/api`; configure all applicable
prefixes, for example `/api,/graphql,/v1`. Prefixes match whole segments (`/apiary`
is not `/api`). Incorrectly configured prefixes cannot protect unknown endpoints.

Missing handlers, wrong methods, and mismatched query strings fail mocked tests,
even when the UI catches the request failure. Diagnostics omit URL/query values.
Direct shared API-client calls are forbidden in mocked mode. Live backend connection
failures produce a service/network diagnostic. Mocked WebSockets are blocked;
live/journey WebSockets may connect to allowlisted hosts.

Browser HTTP hosts, including static asset hosts, must be allowlisted. The router
fetches one response with redirects disabled, rejecting HTTP redirects in all
browser modes because subsequent redirect hops bypass routing. Redirect mocks are
also rejected. Use final URLs or client-side navigation. Applications that require
HTTP redirects need a future interception enhancement. Responses are buffered, so streaming HTTP/SSE is
outside the supported scope. This is not an OS network sandbox: trusted native
tests can bypass it using Node networking, raw Playwright APIs or separate contexts.

## Verification

`npm run test:modes` uses Playwright webServer to start and stop a local framework
harness on port 4187; an existing server is not reused. It executes YAML and native
tests in all four projects, including an expected-failure check for fixture-level
missing-mock reporting. Backend tests specify a nonexistent browser executable to
prove that they do not launch a browser. This harness is separate from the Phase 6
application demo.

`npm run test:engine` checks method/query mismatches, popups, redirects, allowlists,
and WebSockets with Chromium. `npm run test:unit` checks actual discovery in child
processes, exact mode counts, and exclusion of harness files from normal suites.
