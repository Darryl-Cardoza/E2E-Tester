# Authentication and owned test data

Authentication and synthetic data are scoped to one Playwright test attempt.
There is no cross-worker or cross-retry authentication cache, and no authentication
state is written to disk. Each named authentication profile has its own API context,
so its cookies cannot leak into anonymous requests or another profile.

## Profiles

| Profile        | Configuration                                            |
| -------------- | -------------------------------------------------------- |
| `test-user`    | `TEST_USER_TOKEN` bearer token                           |
| `test-admin`   | `TEST_ADMIN_TOKEN` dedicated test administrator token    |
| `expired-user` | `TEST_EXPIRED_TOKEN` for negative authorization tests    |
| `test-session` | `TEST_SESSION_LOGIN_PATH`, `TEST_EMAIL`, `TEST_PASSWORD` |

Environment-prefixed settings take precedence: for example `STAGING_TEST_USER_TOKEN`
over `TEST_USER_TOKEN` when `TEST_ENV=staging`. Other environment prefixes are ignored.
Unprefixed values should come from the selected GitHub Environment or local `.env`.
No default real credentials are supplied. Mocked frontend execution never logs into
a live backend or requires configured session credentials.

The session adapter POSTs `{email, password}` to the configured root-relative login
path. It requires a successful HTTP response, preserves returned cookies, and never
follows redirects. Applications with a different login contract should configure a
native browser login callback or extend this application-specific adapter. A later
401 remains a testable response; tokens are not automatically refreshed.

API YAML uses `auth: test-session` or `auth: test-user` on `api.request`.
Frontend-live/journey YAML can set top-level `browserAuth: test-session` to transfer
session cookies before its steps. Native tests use `test.use({browserAuthProfile:
'test-session'})`. Bearer profiles are API-only; tokens are not injected into browser
storage by convention. Browser reuse rejects unrelated origins and broad-domain
cookies. The current implementation supports cookies and localStorage, not sessionStorage.

Native tests can call `authentication.loginInBrowser('custom-session', page, login)`
with an async application-specific callback that completes login. This captures state
in memory and makes it available through `authentication.context('custom-session')`.
State cannot be overwritten after a profile is initialized. Direct API contexts
returned by this method are trusted native capabilities; use `scenarioContext.api`
for normal allowlisted requests.

## Data ownership and cleanup

`scenarioContext.data.generate` and YAML `data.generate` share unique UUID-based
generation. Emails use the reserved `example.test` domain. Each scenario gets a
separate random `testOwner`, including retries and concurrent workers.

`config/data-resources.ts` explicitly lists allowed owned-data collections. Defaults
are `test-users` at `/api/test-users` and `test-records` at `/api/test-records`; a
developer adapts this map to the target application's dedicated test APIs once.
QA authors then create ordinary records without modifying runtime code:

```yaml
setup:
  - action: data.generate
    kind: email
    saveAs: email
  - action: data.create
    resource: test-users
    body:
      email: '${generated.email}'
    saveAs: user
    auth: test-admin
```

Use `${generated.user.id}` in subsequent steps. `data.create` is an additive v1
action with required `resource`, JSON-object `body`, `saveAs`, and optional `auth`.
It is forbidden in mocked execution. Native tests call
`await scenarioContext.data.create('test-users', {email}, 'test-admin')`.

The server contract must:

1. POST the collection with `testOwner` and return `{id, testOwner, ...}`. IDs must
   contain only letters, digits, underscores, and hyphens.
2. GET `/collection/id` with the same authentication profile, returning the record
   and ownership fields (or 404 if already removed).
3. DELETE only that ID, atomically enforcing the supplied `X-Test-Owner` header.
   The framework checks ownership first; the server's atomic check prevents a
   change between GET and DELETE from deleting another owner's record.
4. Return 200/204/404 for completed deletion. A final GET must confirm 404.
   Asynchronous deletion returning 202 is not accepted as completed cleanup.

Fixture teardown attempts every registered owned record in reverse creation order
after success or failure, before disposing authentication contexts. A missing record
is already clean. Ownership mismatch fails cleanup without sending DELETE. Cleanup
errors identify the record path/ID, are separate from the test's primary failure,
and failed records remain available for an explicit retry via `data.cleanup()`.
Do not put secrets in IDs or resource paths.

Only `data.create` enrolls records automatically. Arbitrary `api.request` mutations
are not assumed to be safe to delete. There is no bulk cleanup or database access.
If POST succeeds but its response is lost/malformed, or the process is killed,
automatic cleanup cannot guarantee recovery. Use server-side ownership auditing or
TTL policies on dedicated test collections; never run unrestricted deletion.

HTTP redirects/streaming limitations from Phase 4 still apply to browser login.
Playwright traces and internal API diagnostics can contain sensitive application
data; full artifact sanitization remains a hardening task. Use dedicated synthetic
accounts, least-privilege profiles, and restricted artifact access.
