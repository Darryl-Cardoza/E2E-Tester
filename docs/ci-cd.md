# CI/CD

The repository has two GitHub Actions workflows in `.github/workflows/`:

| Workflow       | File                 | Trigger                                 | Secrets                |
| -------------- | -------------------- | --------------------------------------- | ---------------------- |
| Validate tests | `validate-tests.yml` | Pull requests, pushes to `main`, manual | None                   |
| Manual E2E     | `manual-e2e.yml`     | Manual (`workflow_dispatch`) only       | Per GitHub environment |

Neither workflow runs on push to a feature branch, on a schedule, or after an application
deployment. Those triggers are out of scope for version 1.

## Validate tests (`validate-tests.yml`)

Runs against the local demo, so it needs no secrets and no staging access. Steps:

1. `npm ci` and Chromium install.
2. Typecheck, lint, format check, and YAML validation.
3. Playwright test discovery (`npm run test:list`) and the YAML scenario inventory
   (`npm run list:scenarios`).
4. Unit and engine tests, the full local suite, and the four-mode verification.
5. Dependency vulnerability and license reports. These steps are non-blocking and
   write to the job summary.
6. Reports and failure artifacts (see below).

## Manual E2E (`manual-e2e.yml`)

Start it from the Actions tab with **Run workflow**. Inputs:

- `environment`: `local-demo` (default), `development`, or `staging`.
- `project`: `all`, `frontend-mocked`, `frontend-live`, `backend`, or `journeys`.
- `tag`: optional grep such as `@smoke`.

`local-demo` runs with no secrets. Each external environment runs in a GitHub
environment with the same name as the input. Configure required reviewers on that
environment to gate production-like runs.

### Configure each external environment

Create a GitHub environment named `development` or `staging`, then add:

| Kind     | Name                   | Purpose                                                                      |
| -------- | ---------------------- | ---------------------------------------------------------------------------- |
| Variable | `FRONTEND_BASE_URL`    | Frontend origin, for example `https://app.example.test`                      |
| Variable | `API_BASE_URL`         | API origin                                                                   |
| Variable | `ALLOWED_TARGET_HOSTS` | Comma-separated exact hosts, for example `app.example.test,api.example.test` |
| Secret   | `TEST_EMAIL`           | Synthetic login email (optional)                                             |
| Secret   | `TEST_PASSWORD`        | Synthetic login password (optional)                                          |
| Secret   | `TEST_USER_TOKEN`      | Synthetic user bearer token (optional)                                       |
| Secret   | `TEST_ADMIN_TOKEN`     | Admin token for owned-data creation (optional)                               |
| Secret   | `TEST_EXPIRED_TOKEN`   | Expired token for rejection checks (optional)                                |

Credentials and target settings are scoped to the test step, so dependency installation
never receives them. Use only values issued for synthetic accounts, never real customer
accounts.

## Reports, metadata and artifacts

Every run's Playwright reports include run metadata: environment, application build ID
(`APP_BUILD_ID`, set to the commit SHA in CI), Git commit, and start timestamp. The job
summary also lists the commit, trigger, environment, project, and tag.

| Artifact                                                    | Contents                                     | Retention |
| ----------------------------------------------------------- | -------------------------------------------- | --------- |
| `validate-reports` / `manual-*-reports`                     | HTML report, JUnit XML, JSON results         | 14 days   |
| `validate-failure-artifacts` / `manual-*-failure-artifacts` | Traces and screenshots, only after a failure | 7 days    |

Traces can contain application data, so restrict who can download artifacts.

Failures are categorized in the step error text and in a `failure-category` annotation:

- `assertion`: the product behaved differently from the expectation.
- `invalid-definition`: the YAML or its variables cannot run as written.
- `infrastructure`: a timeout, refused connection, or unavailable service.
- `setup-cleanup`: owned test data could not be created or removed.

After each run, the framework rewrites the JUnit and JSON reports, the failure text, and
the HTML report data, replacing every configured password and token with `[REDACTED]`.
Traces and screenshots are binary and are not rewritten.

## Pinned actions

Third-party actions are pinned to commit SHAs, with the major version noted in a comment.
Update the pins deliberately, after reviewing the release.

## Limits

- The workflows have not run on GitHub yet. The first push is the real check.
- External runs depend on the target's test-data API contract. See
  [authentication and owned data](authentication-and-data.md).
- See [troubleshooting](troubleshooting.md) for failed-workflow diagnosis.
