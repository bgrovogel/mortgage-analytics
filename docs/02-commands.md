# 2. Commands

> **Every command you need, in one place.** Run them from the repository root unless a line says `cd client`. The
> shell examples are bash; they work the same in PowerShell except where noted.

**Read time:** 7 min · **Best for:** running, testing and shipping it · **Needs:** .NET 10 SDK, Node 22.22+, Python 3.10+

**On this page:** [Prerequisites](#prerequisites) · [Run it](#run-it) · [Test it](#test-it) ·
[Change the database](#change-the-database) ·
[Check the math against the independent models](#check-the-math-against-the-independent-models) ·
[Check the docs' test counts](#check-the-docs-test-counts) · [Ship it](#ship-it) · [Troubleshooting](#troubleshooting)

---

## The short version

| I want to... | Run |
|---|---|
| **See the whole app** | `docker compose up --build`, then open http://localhost:8080 |
| **Work on it, with live reload** | `dotnet run --project src/MortgageAnalytics.Api` and, in a second terminal, `cd client && npm start` (http://localhost:4200) |
| **Run every test** | `dotnet test`, then in `client/`: `npm test` and `npm run e2e` |
| **Check it as CI will** | the above, plus `npm run lint`, `npm run typecheck` and `python tools/doc-check/doc_counts.py` |

Everything else is below, grouped by job.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| .NET SDK | 10.0.x | `dotnet --version` |
| Node.js | 22.22+ (or 24+) | `node --version` |
| Docker Desktop | any recent | `docker --version` (only for the container) |
| Python | 3.10+ | `python --version` (only for the independent model checks) |

---

## Run it

### Option 1: Docker, the whole app in one command

```bash
docker compose up --build        # build the image and start the app + Mailpit
docker compose up -d --build     # the same, in the background
docker compose logs -f app       # follow the app's logs (JSON, one line per API request, each with its request id)
docker compose down              # stop (data is kept on the volume)
docker compose down -v           # stop AND delete the data volume (accounts, saved calculations)
docker compose --profile https up --build   # also Caddy on https://localhost:8443, as a deployment behind HTTPS
```

The `https` profile puts [Caddy](https://caddyserver.com/) in front of the app (`caddy/Caddyfile`), with a certificate
from Caddy's own local authority, so the browser warns once. The app believes Caddy's `X-Forwarded-*` headers, and only
Caddy's (its fixed address is `ForwardedHeaders__KnownProxies__0`), so over HTTPS the session cookie is `Secure`. Emailed
links still point at http://localhost:8080.

| URL | What |
|---|---|
| http://localhost:8080 | The app |
| http://localhost:8080/swagger | API docs (Swagger UI) |
| http://localhost:8080/health | Health check (`Healthy`) |
| http://localhost:8025 | Mailpit: the sign-up and password-reset emails |

The container runs in **Production** mode: no dev mailbox, emails go to Mailpit over SMTP.

### Option 2: local development (two terminals)

```bash
# Terminal 1: the API on http://localhost:5080 (Development mode, opens Swagger)
dotnet run --project src/MortgageAnalytics.Api

# Terminal 2: Angular on http://localhost:4200, live reload
cd client
npm install          # first time, or after package.json changes
npm start            # ng serve; proxies /api and /swagger to :5080 (client/proxy.conf.json)
```

Open http://localhost:4200. In Development the API writes emails to a file outbox (`src/MortgageAnalytics.Api/App_Data/outbox`),
and the app shows them at **http://localhost:4200/dev/mailbox**: sign up, open the email there, click the link.

`dotnet watch --project src/MortgageAnalytics.Api` restarts the API on every C# change.

**Visual Studio / Rider:** open `MortgageAnalytics.sln`, set *MortgageAnalytics.Api* and *client* as multiple
startup projects, and press F5.

### Configuration you might set

| Setting | Default | Purpose |
|---|---|---|
| `ConnectionStrings:Calculations` | `Data Source=calculations.db` | The SQLite file |
| `DataProtection:KeysDirectory` | `App_Data/keys` | Keys that sign sessions and emailed links |
| `Email:Smtp:Host`, `Port`, `Username`, `Password` | none (file outbox) | Send real email |
| `Email:From`, `Email:PublicUrl` | `no-reply@mortgage-analytics.local`, `http://localhost:4200` | Sender address; the site address used in email links |
| `Email:OutboxDirectory` | `App_Data/outbox` | Where emails go when no SMTP host is set |
| `ASPNETCORE_ENVIRONMENT` | `Development` locally, `Production` in Docker | The dev mailbox exists only in Development |

Set them in `appsettings.Development.json`, with user secrets (`dotnet user-secrets set "Email:Smtp:Host" "smtp.example.com" --project src/MortgageAnalytics.Api`),
or as environment variables with `__` for `:` (e.g. `Email__Smtp__Host`).

---

## Test it

> **Stop the dev API before you build or test.** A running API locks its DLLs, and the build fails with
> `MSB3026: Could not copy ... being used by another process`.

```bash
dotnet test                              # every .NET test: Domain, Application, Infrastructure, API, Conventions

cd client
npm run lint                             # angular-eslint: TypeScript and template rules (CI runs it)
npm run typecheck                        # tsc over the Jest and Playwright code, which run without checking types (CI runs it)
npm test                                 # Jest unit tests + coverage; fails below 85%
npm run test:watch                       # re-runs affected tests as you save (no coverage)
npm run e2e:install                      # first time only: downloads Chromium for Playwright
npm run e2e                              # Playwright: builds the app and serves it from the API on :5090, as in production
```

### Run a subset

```bash
dotnet test tests/MortgageAnalytics.Domain.Tests                                  # one project
dotnet test --filter "FullyQualifiedName~AdjustableRateTests"                    # one class
dotnet test --filter "Name~TheMargin_IsTheFloor"                                 # one test

cd client
npx jest src/app/features/calculator/loan-form                                    # one folder
npx jest -t "sends the ARM's margin"                                              # tests whose name matches
npx playwright test e2e/calculator.spec.ts                                        # one e2e file
npx playwright test -g "margin is its floor"                                      # e2e tests whose name matches
npx playwright test e2e/accessibility.spec.ts                                    # only the axe accessibility scans
npx playwright test --ui                                                          # Playwright's UI: step through, see the browser
npx playwright show-report                                                        # the HTML report after a failure
```

### Coverage reports

```bash
# Backend: the same report and 85% gate CI uses
dotnet tool restore
dotnet test --collect:"XPlat Code Coverage" --results-directory ./coverage
dotnet reportgenerator -reports:"coverage/**/coverage.cobertura.xml" -targetdir:coverage/report -reporttypes:Html
# open coverage/report/index.html

# Frontend: npm test writes client/coverage/lcov-report/index.html
```

### Mutation testing

```bash
dotnet tool restore
cd tests/MortgageAnalytics.Domain.Tests
dotnet stryker                           # about 2 minutes; fails below 95%
# open StrykerOutput/<date>/reports/mutation-report.html: each surviving mutant, in its source line
```

A survivor is either a missing assertion (write the test) or code that can never change a result (remove it). On
Windows, the `target-framework` in `stryker-config.json` matters: without it, Stryker's project analysis falls back to
Visual Studio's MSBuild, which is too old for the .NET 10 SDK.

### Type-check and build without running

```bash
dotnet build -warnaserror                # the same as CI: a warning or a missing doc comment fails
cd client && npx tsc -p tsconfig.app.json --noEmit    # type-check the Angular app
cd client && npm run build               # production build into client/dist/client/browser
```

---

## Change the database

Saved calculations and accounts are stored with EF Core. After changing an entity or `CalculationsDbContext`:

```bash
dotnet tool restore                      # installs dotnet-ef (pinned in .config/dotnet-tools.json)
dotnet ef migrations add <Name> --project src/MortgageAnalytics.Infrastructure --startup-project src/MortgageAnalytics.Api
dotnet ef migrations list   --project src/MortgageAnalytics.Infrastructure --startup-project src/MortgageAnalytics.Api
```

You don't run `database update` by hand: the API applies pending migrations at startup (`MigrateDatabaseAsync`
in `Program.cs`). A test (`SavedCalculationRepositoryTests`) fails if the model has changes that no migration
covers.

**Start from an empty database locally:** stop the API and delete `src/MortgageAnalytics.Api/calculations.db`.
In Docker: `docker compose down -v`.

---

## Check the math against the independent models

```bash
python tools/rate-check/rate_model.py              # prints the ARM and buydown reference values the tests pin
python tools/strategy-check/strategy_model.py      # prints the reference households
# with the API running on :5080:
python tools/strategy-check/compare_with_api.py    # 300 random households, every field: expect 300 identical
python tools/calculator-check/compare_with_api.py  # 300 purchases + 300 refinances, every field: expect all identical
```

---

## Check the docs' test counts

```bash
python tools/doc-check/doc_counts.py               # counts the tests, names every count in the docs that is out of date
python tools/diagrams/make_diagrams.py             # redraws the docs' diagrams and charts (checks the chart numbers first)
```

Run it after adding or removing tests (CI does too). Stop the dev API first: it builds the test projects.

---

## Ship it

```bash
git push                                  # CI runs on every push to main and on pull requests
gh run list --limit 3                     # recent CI runs (GitHub CLI)
gh run watch                              # follow the current run
docker build -t mortgage-analytics .      # the image CI builds
```

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `MSB3026: Could not copy ... being used by another process` | The API is still running and locks its DLLs. Stop it (Ctrl+C), then build or test. On Windows: `Get-NetTCPConnection -LocalPort 5080` finds it. |
| The app shows "We couldn't run that calculation" everywhere | The API isn't running on :5080, or `npm start` was started before it. Start the API; the proxy picks it up. |
| Port 4200 or 5080 already in use | An old `ng serve` or API. Stop it, or `npm start -- --port 4300`. |
| Playwright tests time out on the first run | The first `dotnet run` compiles everything. Run `dotnet build` once first, or start both servers yourself (Playwright reuses them). |
| Sign-in says the email isn't confirmed | Open the dev mailbox (`/dev/mailbox`) or Mailpit (:8025) and click the link. |
| Styles don't update in `ng serve` | Restart `npm start`; a long-running dev server sometimes misses SCSS partial changes. |
| `dotnet ef` not found | `dotnet tool restore`. |
| `NU1004: The packages lock file is inconsistent` | A package changed in `Directory.Packages.props` (or a project) but its `packages.lock.json` didn't. Run `dotnet restore --force-evaluate` and commit the lock files with the change. |
| `A compatible .NET SDK was not found` (requires 10.0.100) | `global.json` asks for the .NET 10 SDK. Install it (`winget install Microsoft.DotNet.SDK.10`). |

---

← Previous: [1. Tech stack](01-tech-stack.md) · [Guide contents](README.md) · Next: [3. Architecture](03-architecture.md) →
