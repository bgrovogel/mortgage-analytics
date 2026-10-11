# 8. Interview guide

How to present this project, and answers to the questions you are likely to get. Every answer points to real
code, so you can open the file and show it. Practise saying them out loud; don't memorise them word for word.

## The pitch

**In 30 seconds:**
> "Mortgage Analytics is a full-stack mortgage calculator: a .NET 9 API and an Angular 19 app in one Docker
> container. It answers three questions: what a home really costs to own, with taxes, PMI and extra payments;
> whether refinancing actually saves money; and whether spare cash should pay down the mortgage or be invested.
> The math is exact to the cent and checked against independent Python models, and about 1,170 tests run in CI."

**In 2 minutes, add:**
1. **Architecture:** Clean Architecture in four projects. The domain has no dependencies at all, so the money
   math is tested in isolation. Validation happens twice: friendly messages at the edge, guard clauses in the domain.
2. **The interesting domain rules:** PMI comes off on the *original* schedule; recasts need *one* qualifying lump
   sum; Texas homestead exemptions apply per tax; ARMs reset within caps and stop at a margin floor; a refinance can
   lower the payment and still cost more.
3. **Frontend:** results update as you type (debounce + `switchMap`), one loan is shared across the three pages,
   and every form is driven by one rules table that mirrors the API.
4. **Quality:** TDD, an 85% coverage gate, and conventions tests that use Roslyn to fail the build when a test
   breaks the team's assertion standards.

## "Walk me through the architecture"

Draw four boxes: Api → Application → Domain, and Infrastructure → Application. Then:

> "Dependencies only point inward. The **domain** is pure C#: loans, amortization, taxes, refinancing, strategies.
> It references no packages. The **application** layer holds the use cases: request and response contracts,
> FluentValidation validators, explicit mapping, and services. It also owns the repository *interface*.
> **Infrastructure** implements that interface with EF Core and SQLite, which is dependency inversion: the
> high-level policy defines the port. The **API** is thin minimal-API endpoints, one generic validation filter,
> and a global exception handler that turns everything into ProblemDetails. In production the API also serves the
> Angular build, so it's one container with no CORS."

Then trace one request: [Architecture → One request, end to end](03-architecture.md#one-request-end-to-end).

## Likely questions

### Design and architecture

**Why Clean Architecture for an app this size?**
The domain is the valuable part, and it changes for business reasons, not technical ones. Keeping it free of
ASP.NET and EF Core means its 352 tests run in under a second with no setup, and the storage or web framework can
change without touching it. I kept it light, though: no MediatR, no AutoMapper, no repository for things that
don't need storage. The Infrastructure project only appeared when saved calculations needed a database.

**Where do you apply SOLID?** (Have one example ready for each.)
- **S:** `PaymentFormula` does the math, `AmortizationCalculator` builds schedules, `LoanComparer` compares, and the
  endpoints only do HTTP.
- **O:** a new housing cost is a new `IHousingCost`; adding the school tax and growth needed no change to the
  amortization engine.
- **L:** every `IExtraPaymentRule` and `IHousingCost` can stand in for another inside the composites.
- **I:** small interfaces of one or two members each.
- **D:** services depend on `ILoanComparer` and `TimeProvider`; Application owns `ISavedCalculationRepository`.

**What design patterns did you use?**
- **Composite:** `ExtraPaymentPlan`, `HousingCostPlan`.
- **Strategy:** the rules and costs behind their interfaces.
- **Template Method:** `CalculationStore`, where each page's store fills in `send$`, `loanOf` and `describe`.
- **Adapter / port:** the repository.
- **Builder:** in tests, `A.Request...`.
- **Factory:** `RecastPolicy.OnLumpSum`, and the injectable `ChartFactory`.
- **Container/presentational components** on the client.

**Why validate twice?**
They protect different things. FluentValidation gives the *user* field-level messages ("Interest rate must be
between 0% and 30%"). Domain guard clauses protect the *code*: no caller can ever build an invalid `LoanTerms`.
If a guard fires in production, bad input got past the validator, which is a bug, so it's logged and returned as
a generic 500 that leaks nothing.

**Why hand-written mapping instead of AutoMapper?**
The mapping makes business decisions: a zero amount means "none", "Recast" becomes a recast policy, and PMI applies
only below 20% down. As explicit code, each decision can be read and unit-tested. AutoMapper would hide them in
configuration, and mistakes would only show up at runtime.

### C# and .NET

**Why `decimal`?**
`double` is binary floating point and can't represent 0.1 exactly, so cents drift. `decimal` is base-10. One catch:
`Math.Pow` only takes `double`, so `DecimalMath.Pow` does exponentiation by squaring in `decimal`. Rounding is in one
place, `Money.Round` (to cents, half away from zero), and the final payment absorbs the drift so every schedule
ends at exactly $0.00.

**Minimal APIs or controllers?**
Minimal APIs: less ceremony, and endpoints that are plain functions. `TypedResults` lets OpenAPI infer the
response types. Cross-cutting concerns live in an endpoint filter (`ValidationFilter<T>`, generic, one for every
endpoint) and in an `IExceptionHandler`. Controllers would make sense if the team already standardised on them.

**How do you handle errors?**
Everything returns RFC 9457 ProblemDetails:
- **400** validation errors keyed by JSON path, from the filter;
- **400 / 413** for bodies that can't be read, which keep their own status;
- **404** for an unknown API route, as JSON rather than the SPA's index page;
- **500** with a generic title for anything else, logged with source-generated `[LoggerMessage]`.

**How do you test code that depends on "today"?**
Services take `TimeProvider`; tests pass `FakeTimeProvider` with a fixed date. The same seam exists on the client
for charts: the Chart.js constructor is injected, so tests use a fake (jsdom has no canvas).

**Service lifetimes?**
- The domain services and use cases are **singletons**: they're stateless.
- The saved-calculation service and repository are **scoped**, matching the EF Core `DbContext`, which isn't
  thread-safe and is meant to live for one request.

### Data

**Why SQLite? Would it scale?**
It's one file with no server, which suits a demo and makes tests real (in-memory SQLite, built by the real
migrations). Its limit is a single writer. For production I'd switch the EF Core provider to PostgreSQL or SQL
Server, which is a one-line change plus new migrations, because nothing outside Infrastructure knows about SQLite.

**Why store the inputs as JSON?**
A saved calculation is always read and written whole, never queried by field, so normalising forty-odd fields into
tables would add joins and migrations for no benefit. The contracts can grow without a schema change.

**What about versioning that JSON?**
Every change so far has only *added* fields, which old saves load as defaults, so there is no version number yet.
Instead `StoredFormatTests` loads a save of each kind in today's format, with every option set, and checks that
every value comes back. A rename or removal fails CI and names the field. The day a breaking change is really
needed, I'd add a `schemaVersion` to the stored JSON and upgrade old saves when they load. The URLs are
already versioned (`/api/v1`).

**How is one user kept from seeing another's data?**
- The owner id comes from the session's claims, never from the request.
- The repository filters **in the query** (`WHERE OwnerId = @user`), not after loading.
- Another user's item returns **404, not 403**, so its existence isn't revealed.
- Deleting a user cascades to their calculations.

### Security

**How does authentication work?**
ASP.NET Core Identity (`MapIdentityApi`) handles it:
- **Passwords** are hashed, and repeated failures lock the account.
- **Sign-in** waits for a confirmed email.
- **The session** is an **HttpOnly, SameSite=Strict cookie**, so scripts can't read it (unlike a token in
  `localStorage`), and other sites can't make the browser send it, which blocks CSRF.
- **The keys** that sign cookies and emailed links are persisted, so restarts don't sign people out.

**Other measures?**
- "Forgot password" answers the same for any email, so it can't be used to find accounts.
- Return URLs after sign-in must be same-site paths, so there's no open redirect.
- The dev mailbox endpoint exists only in Development.
- The container runs as a non-root user.
- **Missing, and next on my list:** rate limiting on sign-in and registration (ASP.NET Core has built-in
  middleware for it).

### Angular

**Signals or RxJS?**
Both, each for what it's good at:
- **Signals** hold state: the request, the result, `busy`, and the form's derived values via `computed`. Templates
  read them directly with `OnPush`.
- **RxJS** handles time: `debounceTime` and `switchMap` in `latestRequest`.

**How do results update as you type without race conditions?**
- **Debounce** 400 ms, so typing "375000" sends one request.
- **`switchMap`** cancels the in-flight request when a newer one starts, so a slow old response can't overwrite a
  new one.
- **`catchError` inside** the `switchMap`, so one failure doesn't kill the stream.
- **Each request is numbered**, so `busy` only clears for the latest one.

**How do you avoid duplicating logic across three calculator pages?**
- `CalculationStore` (a base class) holds the state, saving and loan sharing; each page's store adds only what
  differs.
- `<app-calculation-page>` gives every page the same layout, errors and stale-results notice through content
  projection.
- `shared/rate-options` handles fixed, buydown and ARM for all three forms.
- One `FieldRule` table per form drives the validators, the messages and the problems list.

**How does the shared loan work?**
`SharedLoanStore` keeps the balance, rate, months left, home value, original loan and rate type, plus a version
number. A page records the last version it saw; when it opens, a newer version fills its form, and the form says
where the loan came from. Only a loan the user changes is shared, never a page's default example. And a page that
can only approximate the loan (the calculator rounds to whole years) recognises it as the same loan, so it doesn't
send the rounding back.

### Testing

**How do you do TDD here?**
For a money rule, I write the expected numbers from an independent Python model first, then a failing domain test
that pins them, then the smallest change to pass, then the same outward through validation, mapping, the Angular
form and a Playwright test. Then refactor with everything green. [Example](07-testing.md#how-a-feature-gets-built-tdd).

**Why the Python models?**
Asserting the code's own output only proves it's consistent with itself. A separate model written from the rules
can disagree, and it has: it found a half-cent rounding error (7% ÷ 12 repeats forever, so interest is now
balance × rate ÷ 1,200) and a validator that wrongly rejected a 100% employer match. A script compares 300 random
households against the live API, field by field.

**What are the conventions tests?**
A test project that uses Roslyn to parse every C# test file, and a regex for every Playwright spec. It fails the
build when an assertion has no message, when a test has several assertions outside `Assert.Multiple`, or when a
classic assert is used. Code review standards become automatic.

**Is 85% coverage enough? Why not 100%?**
Coverage only shows what *isn't* executed. It can't show that the assertions are right. The gate stops untested
code from arriving; correctness comes from the independent reference values. The actual figures are ~98% backend
and ~99% Angular lines. Mutation testing (Stryker) would be the next step to measure assertion strength.

**Unit vs. integration?**
- The pyramid: hundreds of fast domain tests at the base.
- Application unit tests with NSubstitute, plus "sociable" tests through the real engine.
- Repository tests on real SQLite.
- API tests with `WebApplicationFactory` (the real pipeline, in memory).
- A thinner layer of Playwright tests for whole user journeys.

### DevOps

**Walk me through the Dockerfile.**
Three stages:
1. Node builds Angular.
2. The .NET SDK restores (its own layer, so code edits don't bust the package cache) and publishes the API.
3. The slim ASP.NET runtime image copies in both, runs as the non-root `app` user, and keeps data on a `/data`
   volume.

Compose adds Mailpit to catch emails locally.

**What does CI do?**
- **Backend:** builds with warnings as errors, runs every .NET test with coverage, fails below 85%.
- **Frontend:** runs Jest with its own 85% gate.
- **End-to-end:** once both pass, builds Angular and runs Playwright against the real API.
- **Docker:** builds the image.

Coverage and failure reports are uploaded as artifacts.

## Trade-offs and what you'd change

Interviewers like a candidate who knows a design's weaknesses. Be ready with these:

| Area | Today | Next |
|---|---|---|
| Database | SQLite, single writer | PostgreSQL via the EF provider; the abstractions are already there |
| Client models | TypeScript mirrors of the C# contracts, kept in step by tests | Generate them from the OpenAPI document (NSwag or openapi-typescript) |
| Security | Identity, lockout, SameSite cookies | Rate limiting on sign-in and registration |
| Runtime versions | .NET 9 (STS), Angular 19 | .NET 10 (LTS); Angular with `ng update`, one major at a time |
| Test strength | Coverage gate + independent models | Mutation testing (Stryker.NET) on the domain |
| History | Loads all of a user's saves | Pagination, once lists get long |
| Scaling out | One container; signing keys on disk | Shared key storage (e.g. a database or blob) before running several instances |
| Saved JSON | No version; a test guards the format | `schemaVersion` + upgrade on load, at the first breaking change |

## Stories for "tell me about a hard bug"

All of these are **fixed**, and each has a test that fails if it ever comes back. That's what makes them good
stories. Tell one as situation → what you did → result → how you made sure it stays fixed.

1. **The half-cent (a real bug, fixed).** The refinance reference model disagreed with the engine by half a cent.
   The cause: monthly interest was computed as balance × (7% ÷ 12). 7 ÷ 12 repeats forever, so `decimal` rounded
   the monthly rate before the multiplication, and an exact half cent came out a hair under and rounded down.
   - **Fix:** balance × rate ÷ 1,200, in one place (`LoanTerms.MonthlyInterestOn`).
   - **Guarded by:** `AmortizationCalculatorTests` ("an exact half cent rounds up, away from zero") and the
     refinance reference values in `ReferenceRefinances`.
   - **Lesson:** an independent model finds what self-consistent tests never will.
2. **The echoing loan (a real bug, fixed).** The calculator rounds a shared loan's term to whole years. Its rounded
   version was being shared back, quietly changing the loan on the other pages.
   - **Fix:** `matchesShared`: a page recognises "this is the shared loan, as close as I can hold it" and doesn't
     re-share it.
   - **Guarded by:** the e2e test "the Calculator takes the loan too, rounding part years without changing them
     elsewhere" (22.5 years left shows as 23 on the Calculator and stays 22.5 on the other pages).
3. **The stale response (a race, designed out).** In an "update as you type" UI, an older slow response can
   arrive after a newer one and overwrite it, or end the loading state too early. It was designed out from the start
   rather than found in production, so tell it as a design decision.
   - **How:** `switchMap` cancels the old request; numbering requests keeps `busy` true until the latest answers;
     the `catchError` inside the `switchMap` keeps one failure from stopping every later update.
   - **Guarded by:** seven tests in `latest-request.spec.ts`, e.g. "ignores a slow response once a newer request has
     been made" and "recovers after a failure".

## If you're asked how you built it

Be straightforward about your process and tools, including any AI assistance. What interviewers want to know is
whether you understand and can own the code. These docs, the tests and the reference models are how you show
that: pick any feature, explain the rule, open the test that pins it, and change it live.

## Numbers worth remembering

| | |
|---|---|
| Reference loan | $200,000 at 6%, 30 years → **$1,199.10** a month, **$231,677.04** total interest |
| + $200 a month | **108** payments sooner, **$79,800.86** less interest |
| Recast boundary | $9,999.99 doesn't recast; $10,000 does |
| Refinance trap | 7% → 6% saves $321.69 a month, but costs **$17,415.28 more** (60 payments added) |
| Tests | 643 .NET · 461 Jest · 70 Playwright; 85% coverage gate |
| Stack | .NET 9, EF Core 9, SQLite, Identity · Angular 19, signals, RxJS, Chart.js · Docker, GitHub Actions |
