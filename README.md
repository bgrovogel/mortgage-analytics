# Mortgage Analytics

**See what a home really costs, whether a refinance pays, and whether spare cash should pay down the mortgage or be
invested, with the real rules behind every number.**

[![CI](https://github.com/bgrovogel/mortgage-analytics/actions/workflows/ci.yml/badge.svg)](https://github.com/bgrovogel/mortgage-analytics/actions/workflows/ci.yml)
![.NET 10](https://img.shields.io/badge/.NET-10-512BD4)
![Angular 22](https://img.shields.io/badge/Angular-22-DD0031)
![Mutation score gate](https://img.shields.io/badge/mutation%20score-%E2%89%A595%25-2563eb)

![The calculator: a $375,000 home with 5% down, $200 a month extra, and every cost of owning it](docs/images/calculator.png)

A .NET 10 API and an Angular 22 app, shipped as one Docker container. It is small on purpose: the domain (exact money
math, lender recast rules, PMI removal, Texas homestead taxes, adjustable rates, buydowns, tax-aware investing) is
rich enough to show real engineering judgment, and the code is small enough to read in a sitting.

**Contents:** [What it does](#what-it-does) · [Highlights](#highlights) · [Quick start](#quick-start) ·
[Tests](#running-the-tests) · [API](#the-api) · [Architecture](#architecture) · [Documentation](#documentation) ·
[Tech stack](#tech-stack) · [Next](#what-id-add-next)

---

## What it does

| Page | The question it answers |
|---|---|
| **Calculator** | *What will this home cost me, month by month and year by year?* Principal and interest; property taxes (one rate, or Texas school, county/city and MUD taxes with homestead exemptions, the over-65 ceiling and the appraisal cap); insurance, HOA dues, PID and PMI; conventional, FHA or VA loans; extra payments and lender recasts; buydowns, discount points and ARMs; a projection of every cost over the loan, and of your equity; and the cash to close, line by line as a Loan Estimate shows it. |
| **Refinance** | *Should I refinance?* The rest of today's loan against the new one, closing costs included, with the break-even. It catches the trap most calculators hide: a lower payment can cost more overall, because a new 30-year loan restarts the clock. |
| **Pay off or invest** | *Should spare cash pay down the mortgage, or be invested?* Three strategies played out month by month for 30 years, with the 401(k) match, IRA, RSUs, ESOP, ESPP, the standard deduction and taxes, in three markets, ranked on a risk-adjusted return. |
| **History** | Save any result under a name with a free account, and reopen it exactly as it was. The calculators need no account, and from **Your account** you can change your password, or delete the account with everything in it. |

A loan typed on one page is carried to the others. **Every rule, in detail: [What it does](docs/00-features.md).**

<p>
  <img src="docs/images/refinance.png" alt="Refinance: refinancing to 6% costs $17,415 more over the life of the loan" width="49%" />
  <img src="docs/images/pay-off-or-invest-dark.png" alt="Pay off or invest, in dark mode: invest the difference, with a bad-decade warning" width="49%" />
</p>

---

## Highlights

- **Money math you can trust.** `decimal` throughout, every schedule ends at exactly $0.00, and the expected values
  in the tests come from independent Python models, not from this code. Scripts compare 300 random purchases, 300
  refinances and 300 households with the live API, field by field. They have caught real bugs.
- **Tested from the domain to the browser.** 885 .NET, 576 Jest and 97 Playwright tests, written test-first. An 85%
  coverage gate, a mutation-score gate on the domain (Stryker.NET), a snapshot of the whole API contract, and
  assertion standards enforced at build time with Roslyn.
- **Built like it will be attacked.** Cookie-only sessions, account attempt limits, a Content-Security-Policy that
  every browser test runs under, only the identity endpoints the app uses, and CI that fails on a known vulnerability
  in anything that ships.
- **Designed for the people using it.** One visual language in light and dark mode, the answer first on a phone,
  results as you type, and WCAG 2.2 AA checked by axe on every page.
- **Clean Architecture, kept small.** The domain has no dependencies at all; no MediatR, no AutoMapper, nothing it
  does not need.

---

## Quick start

### With Docker

```bash
docker compose up --build
```

| What | Where |
|---|---|
| The app | http://localhost:8080 |
| API docs (Swagger UI) | http://localhost:8080/swagger |
| Email inbox (Mailpit) | http://localhost:8025, where confirmation and password-reset emails land; nothing leaves your machine |
| Over HTTPS (optional) | `docker compose --profile https up --build`, then https://localhost:8443: Caddy in front, with a local certificate (the browser warns once) |

Accounts, saved calculations and the keys that sign sessions and emailed links live on the
`mortgage-analytics_calculations` volume, so they survive restarts.

### For development

Needs the .NET 10 SDK and Node 22.22+ (or 24+).

```bash
# Terminal 1: the API on http://localhost:5080 (Swagger at /swagger)
dotnet run --project src/MortgageAnalytics.Api

# Terminal 2: the app on http://localhost:4200 (it forwards /api to :5080)
cd client
npm install
npm start
```

> **Accounts work with no mail server.** Without SMTP settings the API writes emails to a local outbox, and in
> Development the app shows them at http://localhost:4200/dev/mailbox (the sign-up and forgot-password screens link
> to it). To send real email, set `Email:Smtp:Host`, `Port`, `Username`, `Password` and `Email:From`.

In Visual Studio or Rider, open `MortgageAnalytics.sln` and start **MortgageAnalytics.Api** and **client** together.
Every command is in the [commands guide](docs/02-commands.md).

### Running the tests

```bash
dotnet test                       # 885 NUnit tests, including the convention tests

cd client
npm run lint                      # angular-eslint: TypeScript and template rules
npm run typecheck                 # tsc over the test code, which Jest and Playwright run without checking types
npm test                          # 576 Jest unit tests; fails below 85% coverage
npm run e2e:install               # first time only: downloads Chromium
npm run e2e                       # 97 Playwright tests (15 are axe accessibility scans); builds the app and serves it from the API, as in production
```

How each layer is tested, the standards the build enforces, coverage and mutation testing:
[Testing and quality](docs/07-testing.md).

---

## The API

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/amortization/calculate` | The purchase analysis (`?includePayments=false` for summaries only) |
| `POST /api/v1/refinance/analyze` | Keep the current loan or refinance it |
| `POST /api/v1/strategies/compare` | Pay off first, invest the difference, or a hybrid, in three markets |
| `POST /api/v1/account/register` · `login?useCookies=true` · `logout` | Create an account (a confirmation email is sent), sign in with a session cookie, sign out |
| `GET /api/v1/account/confirmEmail` · `POST resendConfirmationEmail` | Confirm the email with the code from its link; send the link again |
| `POST /api/v1/account/forgotPassword` · `resetPassword` | Email a reset link; set a new password with its code |
| `GET /api/v1/account/manage/info` | Who is signed in (401 when nobody is) |
| `POST /api/v1/account/password` 🔒 | Change your password, with the current one; this session stays, every other ends |
| `DELETE /api/v1/account` 🔒 | Delete your account and everything saved in it, with your password; signs you out everywhere |
| `GET /api/v1/calculations?search=` 🔒 | Your saved calculations, newest first, filtered by name |
| `GET` · `PUT` · `DELETE /api/v1/calculations/{id}` 🔒 | Read, rename or replace, delete one |
| `POST /api/v1/calculations` 🔒 | Save a calculation, refinance or strategy comparison under a name (201 with `Location`) |
| `GET` · `DELETE /api/v1/dev/outbox` | **Development only:** the local email outbox |
| `GET /health` | `Healthy` when the app and its database answer |

🔒 needs a signed-in user (401 otherwise). Another user's calculation is a **404**, not a 403, so the API never confirms
that it exists. Errors are RFC 9457 ProblemDetails, with validation errors keyed by JSON path. A full request and
response: [Calling the API](docs/04-backend.md#calling-the-api). The full contract: Swagger UI at `/swagger`.

---

## Architecture

![The shape of the system: the Angular app calls Api, which calls Application, which calls Domain; Infrastructure implements Application's port and stores data in SQLite](docs/images/architecture.svg)

Dependencies point inward only: **Api → Application → Domain**, and **Infrastructure → Application**. Application owns
the repository interface and Infrastructure implements it, so neither the domain nor the use cases know a database
exists. The domain references no packages and no ASP.NET types, so the money math is tested, and reusable, on its
own. One request traced from a keystroke to the database and back: [Architecture](docs/03-architecture.md).

---

## Documentation

The [developer guide](docs/README.md) explains how the app is built, and why, in pages meant to be read in order:

| | Page | Read it to know |
|---|---|---|
| 0 | [What it does](docs/00-features.md) | Every feature and rule, page by page |
| 1 | [Tech stack](docs/01-tech-stack.md) | Every tool and library, its version, and why it was picked |
| 2 | [Commands](docs/02-commands.md) | How to run, test, debug, migrate and ship it |
| 3 | [Architecture](docs/03-architecture.md) | The layers, the dependency rule, and one request end to end |
| 4 | [Backend](docs/04-backend.md) | Domain, Application, Infrastructure and API; calling the API; security |
| 5 | [Frontend](docs/05-frontend.md) | Stores, signals, forms, the shared loan, charts, the visual design |
| 6 | [The mortgage math](docs/06-mortgage-math.md) | Every rule with worked numbers, and the modelling decisions |
| 7 | [Testing and quality](docs/07-testing.md) | TDD, the test layers, the enforced standards, independent models, CI |
| 8 | [Interview guide](docs/08-interview-guide.md) | The pitch, likely questions, trade-offs and stories, grounded in the code |
| 9 | [SOLID by example](docs/09-solid-by-example.md) | SOLID in one section of the code, the amortization engine, with real snippets |
| 10 | [Data and storage](docs/10-data-and-storage.md) | What is stored and where, the schema, every query, migrations, backups |

---

## Tech stack

| Layer | Built with |
|---|---|
| **Backend** | ASP.NET Core 10 minimal APIs · FluentValidation · EF Core + SQLite (migrations) · ASP.NET Core Identity (cookie sessions, email confirmation, password reset) · MailKit · Swagger / OpenAPI · RFC 9457 ProblemDetails |
| **Frontend** | Angular 22 (standalone components, signals, typed reactive forms, OnPush, router) · Chart.js · self-hosted Inter |
| **Tests** | NUnit + NSubstitute: 885 backend tests · Jest: 576 Angular unit tests · Playwright: 97 E2E tests, including axe accessibility scans · Stryker.NET · coverage gated at 85% |
| **Delivery** | Multi-stage Dockerfile (one container) · GitHub Actions CI |

Versions, and why each was picked: [Tech stack](docs/01-tech-stack.md).

---

## What I'd add next

- **Tax rate changes:** per-year rate schedules, and the ceiling transfer when a qualifying owner moves.
- **Mutation testing beyond the domain:** the Application layer's mapping and validators.

The design's known limits, and what would change them: [Trade-offs](docs/08-interview-guide.md#trade-offs-and-what-youd-change).
