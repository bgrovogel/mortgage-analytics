# 1. Tech stack

> **Everything the app is built with, where each piece is used, and why it was chosen.** Versions are the ones
> pinned in the repository today (`Directory.Packages.props`, `client/package.json`, `.config/dotnet-tools.json`).

**Read time:** 7 min · **Best for:** "why this library?" questions · **Pinned in:** `Directory.Packages.props`, `client/package.json`

**On this page:** [At a glance](#at-a-glance) · [Backend (.NET 10, C# latest)](#backend-net-10-c-latest) ·
[Frontend (Angular 22)](#frontend-angular-22) · [Testing](#testing) · [Delivery](#delivery) ·
[Deliberately not used](#deliberately-not-used)

---

## At a glance

![The tech stack by layer: Angular 22, TypeScript 6.0, signals, RxJS 7.8 and Chart.js 4.5 in the browser; .NET 10 minimal APIs, FluentValidation 12, Identity, MailKit 4 and Swashbuckle 10 on the server; EF Core 10 and SQLite for data; NUnit 5, NSubstitute 6, Jest 30, Playwright 1.64, axe-core, Stryker.NET 5.0 and Python models for quality; Docker, compose and GitHub Actions for delivery](images/tech-stack.svg)

How the pieces connect: [Architecture](03-architecture.md#the-shape-of-the-system).

---

## Backend (.NET 10, C# latest)

| Technology | Where | Why |
|---|---|---|
| **.NET 10 / C# (latest)** | `src/*` | Records, primary constructors, collection expressions and pattern matching keep the domain short, and `decimal` gives exact money math. .NET 10 is a Long Term Support release (supported to November 2028); `global.json` pins the SDK. |
| **ASP.NET Core minimal APIs** | `src/MortgageAnalytics.Api/Endpoints/` | Endpoints are small static functions grouped with `MapGroup`. Less ceremony than controllers, and `TypedResults` lets OpenAPI infer response types from the code. |
| **FluentValidation 12** | `src/MortgageAnalytics.Application/Validation/` | Readable, testable rules with field-level messages. One generic `ValidationFilter<T>` runs the right validator for every endpoint. |
| **ProblemDetails (RFC 9457)** | `Program.cs`, `Errors/GlobalExceptionHandler.cs` | One standard JSON shape for every error (400 validation, 404, 500), which the Angular app turns into messages. |
| **Swashbuckle (Swagger / OpenAPI) 10** | `Program.cs` | Interactive API docs at `/swagger`, built from the XML doc comments and `<example>` values. |
| **EF Core 10 + SQLite** | `src/MortgageAnalytics.Infrastructure/` | Saved calculations and user accounts. SQLite is one file, needs no server, and fits a demo; EF Core migrations version the schema. Swapping to PostgreSQL or SQL Server is a provider change. |
| **ASP.NET Core Identity** | `Api/Endpoints/AccountEndpoints.cs` | Built-in, well-reviewed accounts: password hashing, lockout, email confirmation, password reset, and the `MapIdentityApi` endpoints. No hand-rolled security. |
| **Data Protection** | `AccountEndpoints.AddAccounts` | Signs the session cookie and the codes in emailed links; keys are kept on disk so restarts don't sign people out. |
| **MailKit 4** | `Api/Email/SmtpMailTransport.cs` | Sends account emails over SMTP. Without SMTP settings, a file outbox is used instead (local dev needs no mail server). |
| **Source-generated logging** | `[LoggerMessage]` in `GlobalExceptionHandler` | No boxing or template parsing at runtime; the analyzers recommend it. |
| **`TimeProvider`** | Application services | "Today" is injected, so tests pin the date with `FakeTimeProvider`. |

**Build settings** (`Directory.Build.props`, shared by every project):
- `TreatWarningsAsErrors`: a warning fails the build.
- `AnalysisLevel latest-recommended`: the .NET code-quality analyzers.
- `Nullable enable`: nullable reference types.
- `GenerateDocumentationFile` on production projects: a public member without an XML doc comment is error CS1591.
- **Central package management** (`Directory.Packages.props`): each NuGet version is written once for the whole
  solution.

---

## Frontend (Angular 22)

| Technology | Where | Why |
|---|---|---|
| **Angular 22** (standalone components) | `client/src/app/` | No NgModules: each component imports what it uses. A full framework (router, forms, HTTP, DI, testing) suits a form-heavy app. |
| **Signals** (`signal`, `computed`, `input`, `output`) | Stores and components | Fine-grained reactive state that templates read directly; derived values (`computed`) update themselves. |
| **OnPush change detection** | Every component | Angular only re-checks a component when its inputs or signals change. Fast, and it forces clear data flow. |
| **Typed reactive forms** (`NonNullableFormBuilder`) | `features/*/…-form/` | The compiler checks every control name and value type. |
| **RxJS 7.8** | `core/state/latest-request.ts`, forms | `debounceTime` + `switchMap` give "results as you type" without stale responses. Signals hold state; RxJS handles time. |
| **Angular Router** | `app.routes.ts` | Pages and the calculator's result tabs each have a URL (bookmarkable, back button works). A functional guard protects History. |
| **HttpClient** (`withFetch`) | `core/services/*-api.service.ts` | One thin service per API area; components never touch `HttpClient` directly. |
| **Inter (`@fontsource-variable/inter` 5.2)** | `styles.scss`, via `angular.json` | The typeface, self-hosted because the CSP allows fonts only from the app; tabular figures keep amounts aligned. |
| **Chart.js 4.5** | `core/charts/` | Line and stacked charts. Wrapped once (`buildLineChart`, `hostChart`) and injected through a factory, so tests use a fake. |
| **SCSS** | `*.component.scss`, `core/forms/_*.scss` | Shared partials for form fields, segmented controls and scroll hints; CSS grid for the two-column layout; light and dark themes. |

---

## Testing

| Technology | Layer | What it does here |
|---|---|---|
| **NUnit 5** (constraint model) | All .NET tests | `Assert.That(actual, Is.EqualTo(x), "message")`, `Assert.Multiple`. NUnit.Analyzers checks usage. |
| **NSubstitute 6** | Application, API | Test doubles: substitute an interface, return values, check calls. No hand-written fakes. |
| **`FakeTimeProvider`** | Application | Pins "today". |
| **`WebApplicationFactory`** | API integration tests | Hosts the real app in memory, with a temporary SQLite file. |
| **Roslyn** (`Microsoft.CodeAnalysis.CSharp`) | Conventions tests | Parses every C# test file to enforce the test standards. |
| **coverlet + ReportGenerator** | CI | Backend coverage, gated at 85% lines and branches. |
| **Stryker.NET 5.0** | CI, `tests/MortgageAnalytics.Domain.Tests` | Mutation testing of the domain: are the assertions strong enough to notice a wrong `<`? Gated at 95%. |
| **Jest 30 + jest-preset-angular** | Angular unit tests | Fast tests in jsdom with Angular's `TestBed`; 85% coverage gate in `jest.config.js`. |
| **Playwright 1.64** | End-to-end | A real Chromium against the production build, served by the real API as in the container, through page objects. |
| **axe-core** (`@axe-core/playwright`) | End-to-end | Scans every page for WCAG 2.2 A/AA problems (contrast, names, roles, structure) in light and dark mode and on a phone. |
| **Python `Decimal`** | `tools/rate-check`, `tools/calculator-check`, `tools/strategy-check` | Independent models, written from the rules, that produce the expected numbers. `tools/doc-check` (standard library only) checks the docs' test counts in CI. |

---

## Delivery

| Technology | Where | Why |
|---|---|---|
| **Docker (multi-stage)** | `Dockerfile` | Stage 1 builds Angular (Node 22 Alpine), stage 2 publishes the API (.NET SDK), stage 3 is the small ASP.NET runtime image holding both. Runs as the non-root `app` user; data on a `/data` volume. |
| **docker compose** | `docker-compose.yml` | The app on :8080 plus **Mailpit** (a local mail catcher, :8025) so sign-up emails can be read. |
| **GitHub Actions** | `.github/workflows/ci.yml` | Six jobs on every push and pull request: backend, frontend, e2e, docker, docs and mutation ([the pipeline](07-testing.md#the-ci-pipeline-githubworkflowsciyml)). |
| **dotnet local tools** | `.config/dotnet-tools.json` | `dotnet-ef` 10.0 (migrations), ReportGenerator 5.5 (coverage reports) and Stryker.NET 5.0 (mutation testing), restored with `dotnet tool restore`. |

---

## Deliberately not used

Choosing what to leave out is part of the design (KISS / YAGNI). Each of these is easy to add when a real need
appears.

| Not used | Because |
|---|---|
| MediatR | Each endpoint calls one service method. A mediator would add indirection without decoupling anything. |
| AutoMapper | Mapping is explicit extension methods (`Application/Mapping/`). They are easy to read, debug and test, and the compiler checks them. |
| NgRx / a state library | A few root services holding signals (`CalculationStore`) cover the app's state. |
| A UI component library | The forms need custom number boxes and layouts; plain HTML and SCSS keep the bundle small and accessible. |
| A separate database server | SQLite in one file is enough for a demo; EF Core keeps the door open. |
| CORS configuration | The API serves the Angular build itself, so the browser only ever talks to one origin. |

---

← Previous: [0. What it does](00-features.md) · [Guide contents](README.md) · Next: [2. Commands](02-commands.md) →
