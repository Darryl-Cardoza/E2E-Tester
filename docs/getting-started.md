# Getting started

Use Node 24 and npm 11:

```sh
npm ci
npx playwright install chromium
npm run validate
npm test
npm run report
```

No `.env` or external credentials are required for the local demo. Keep port 4173
free. Playwright starts/stops the server automatically. HTML reports are in
`playwright-report`; JSON/JUnit reports are in `test-results`.

Run a selected suite with `npm run test:frontend:mock`, `npm run test:frontend:live`,
`npm run test:backend`, or `npm run test:journeys`. Use `npm run test:list` to inspect
discovery, or append `-- --grep ID` to a suite command to select an individual test.

Copy a YAML example, assign a unique ID, edit the steps, validate, and run the
relevant suite. Declare frontend mode eligibility explicitly. Native examples use
the shared fixtures under `tests/typescript`. Both formats share execution and reports.

For an external application, copy `.env.example` to `.env`, select development or
staging, configure frontend/API origins, allowed hosts, API path prefixes, and
dedicated test identities. Adapt the demo routes/selectors and test-data resource
map to that application's contract. These examples are not universal tests for
arbitrary applications. See the authoring, developer, and authentication/data guides.
