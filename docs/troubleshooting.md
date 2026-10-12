# Troubleshooting

Each entry gives the message you will see, what it means, and the fix. Messages are
quoted from the framework's source.

## YAML parse failures

- `...: YAML exceeds the 1 MiB limit` or `YAML nesting exceeds 64 levels`: the file is
  too large or too deeply nested. Split the scenario.
- `YAML aliases, anchors and explicit tags are unsupported`: remove `&anchor`, `*alias`
  and `!tag` syntax. Write each value out.
- `symbolic links are unsupported`: replace the symlink with a real file.

Run `npm run validate` to see every problem with its file path and property path.

## Schema and definition errors

- `/steps/3: additionalProperties ...` or another schema keyword: an unknown field or a
  wrong type. The message names the property path. Check spelling against
  [YAML authoring](yaml-authoring.md).
- `duplicate test ID; first defined in ...`: two files use the same `id`. Rename one.
- `Action handler is not registered`: the action name is not in the registry. Use one of
  the names listed in [YAML authoring](yaml-authoring.md).
- `Invalid contract name` or `Contract schema is not configured or is unreadable`: the
  `schema` value must match a file `schemas/contracts/<name>.json`.

## Missing or invalid variables

- `variable could not be resolved` (`[invalid-definition]`): the reference is missing,
  is not allowlisted, or uses an unknown namespace. Allowed sources are `generated.*`,
  `responses.*`, `data.*`, and the allowlisted environment variables `TEST_EMAIL`,
  `TEST_PASSWORD`, and `TEST_USER_TOKEN`.
- `Recursive variable reference`: a variable refers to itself. Break the cycle.
- `Malformed variable reference`: a `${` has no matching `}`.

Set the environment variable in `.env` (local) or in the GitHub environment (CI). For
the local demo, the credentials are generated automatically.

## Invalid credentials and authentication

- `Authentication profile is not configured`: the step names an `auth` profile that is
  not set. Set the matching token or session variables, see
  [authentication and owned data](authentication-and-data.md).
- `Session login failed; verify dedicated credentials and endpoint`: the login request
  was rejected. Check `TEST_EMAIL`, `TEST_PASSWORD`, and `TEST_SESSION_LOGIN_PATH`.
- `Authentication setup failed; verify profile, credentials and service availability`:
  the profile could not be built. Check the same variables and that the service is up.
- `Live authentication is forbidden in mocked mode`: an authenticated API step appeared in
  `frontend-mocked`. Move it to a live or journey scenario.

## Backend unavailable

- `Backend connection failed; check the configured API service and network`: the API did
  not answer. Confirm `API_BASE_URL` and that the service is running.
- `Frontend resource request failed; check service availability`: the frontend did not
  load.
- `[infrastructure]` on a step: a timeout or refused connection. Re-run once. If it
  persists, check the target.

## Target allowlist

- `Target origin is not allowed`: a relative path resolved to a host outside
  `ALLOWED_TARGET_HOSTS`. Add the exact host, or fix the path.
- `Browser request blocked: target host is not allowlisted`: the page requested an
  external host. Remove the external dependency or allowlist it.
- `Target must be a root-relative path without traversal, backslashes or control characters`:
  rewrite `path` as `/api/...` without `..` segments.

## Browser installation failures

- `Executable doesn't exist` or `Failed to launch`: Chromium is missing. Run
  `npx playwright install --with-deps chromium`.
- On Linux runners, missing system libraries are installed by the `--with-deps` flag.

## Mock failures (`frontend-mocked`)

- `Missing mock handler for ... application API request`: the page called an API that no
  `mock.api` step covers. Add a mock whose method and URL match, then re-run.
- `HTTP redirect blocked by browser isolation`: the mocked or live app redirected through
  HTTP. Use the final URL, or navigate on the client side. See
  [test modes](test-modes.md).
- `Mocks require frontend-mocked mode`: a `mock.api` step ran in another mode.

## Selector and assertion failures

- `[assertion] ... assertion failed`: the page did not match the expectation. Open the
  HTML report and the failure screenshot.
- Locator timeouts that are categorized `infrastructure` mean the element never
  appeared. Check `target` values (`testId`, `role`, `label`, `text`) against the page.
- Prefer `testId` targets. They do not change with copy or layout.

## Flaky tests

- Re-run with `RETRIES=2` locally to see whether the failure is intermittent.
- Assertions retry automatically. Do not add fixed delays; if a step needs one, the
  page is missing a signal to wait for.
- Check whether tests share data. Owned data is per scenario, so shared records point
  to a hard-coded identifier.

## Cleanup failures

- `[setup-cleanup] ... Owned-record cleanup failed`: a created record could not be read,
  verified, or deleted. Check that the target enforces `X-Test-Owner` on deletion and that
  the record's `testOwner` matches. The record may need manual removal.
- `Scenario cleanup failed`: one or more fixtures failed to tear down. Read the
  per-resource lines in the error.
- Lost create responses cannot be cleaned up automatically. See the limits in
  [authentication and owned data](authentication-and-data.md).

## Reading CI failures

- Open the failed job in the Actions tab. The job summary lists the commit, environment,
  project, and tag.
- Download `*-reports` for the HTML report and JUnit XML, and `*-failure-artifacts` for
  traces and screenshots. View traces with `npx playwright show-trace <file>`.
- A failure marked `invalid-definition` is a test-authoring problem. An `assertion` is a
  product behaviour question. An `infrastructure` failure is usually environmental.
