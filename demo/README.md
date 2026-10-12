# Local demo

`npm test` starts the demo with Playwright webServer, runs all four projects, and
stops it. Install Chromium using `npx playwright install chromium` first. The server
binds only to `127.0.0.1:4173`; an existing server is never reused. Users and sessions
are held in memory and disappear on shutdown. This is a test fixture, not a
production application.

The synthetic default email is `qa@example.test`. Passwords, user/admin tokens, and
an invalid-token value are generated in the parent runner and inherited by its
server/workers through `LOCAL_DEMO_*` variables. They are not printed or persisted.
Existing explicitly supplied `LOCAL_DEMO_*` values may override defaults. Generic
external credentials are not used by default. Development/staging neither starts
the demo nor initializes local credentials.

The UI has login validation, loading/error messages, a profile dashboard, and an
empty item list. Login uses client-side History API navigation, compatible with
the framework's HTTP redirect restriction.

| Endpoint                     | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `GET /health`                | Readiness                                             |
| `/login`, `/dashboard`       | Browser UI                                            |
| `POST /api/login`            | Email/password login and HttpOnly session cookie      |
| `GET /api/users/me`          | Session/user-token profile; 401 otherwise             |
| `GET /api/items`             | Empty collection                                      |
| `GET /api/error`             | Controlled 500 response                               |
| `POST /api/test-users`       | Admin-only synthetic user creation                    |
| `GET /api/test-users/:id`    | Admin-only record lookup                              |
| `DELETE /api/test-users/:id` | Admin-only deletion enforcing X-Test-Owner atomically |

Deletion invalidates that user's sessions. The primary user cannot be deleted.
Owned users require an `example.test` email and ownership metadata. The demo
implements the `test-users` adapter, not the optional `test-records` adapter.

Examples cover both authoring formats across all four modes, including owned-user
journeys with fixture cleanup. No application source imports or database access
are required. Tests interact solely through browser pages and HTTP endpoints.
