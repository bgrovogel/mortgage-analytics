# 7. Testing and quality

About 1,170 automated tests in seven suites, written test-first, with the standards enforced by the build.

| Suite | Count | Tools | Speed |
|---|---|---|---|
| Domain | 353 | NUnit | < 1 s |
| Application | 206 | NUnit, NSubstitute, `FakeTimeProvider` | < 1 s |
| Infrastructure | 16 | NUnit, SQLite in memory | ~1 s |
| API integration | 63 | NUnit, `WebApplicationFactory`, NSubstitute | ~2 s |
| Conventions | 6 | NUnit, Roslyn, regex | < 1 s |
| Angular unit | 472 | Jest, jest-preset-angular | ~10 s |
| End-to-end | 83 | Playwright (Chromium), axe-core | ~25 s |

## How a feature gets built (TDD)

Take the ARM margin floor as an example of the order of work:

1. **The independent model first.** Add the rule to `tools/rate-check/rate_model.py` and print the expected
   values: 6% falling toward 2% with 2/2/5 caps stops at 2.75% ($881.34).
2. **A failing domain test** that pins those values (`AdjustableRateTests.TheMargin_IsTheFloor_SoAFallingRateStopsThere`).
3. **The smallest domain change** that makes it pass (`AdjustableRate.Margin`, one line in `RatePath`).
4. **Outward, layer by layer:** a validator test and rule, a mapping test (`RateOptionTests.AnArmsMargin_ReachesTheEngine`),
   the contract; then Jest tests for the form field and the request it sends; then a Playwright test that types
   the margin and reads the schedule.
5. **Refactor with the tests green**, e.g. moving the ARM mapping into one shared `RateOptionMapper`.
6. **Run everything**, including the 300-household comparison against the model.

## What each layer proves

**Domain**
- The payment formula against known values.
- Invariants for every loan shape: it ends at exactly $0.00, the principal sums to the loan, every amount is
  whole cents, the balance never rises.
- Every guard, identified by its message.
- The rules: recast boundaries, PMI at 78% and 80%, exemptions, the cap, ceilings, installments, ARMs, buydowns,
  refinance savings and break-even, every strategy and scenario, all against the independent models.

**Application**
- **Unit tests:** the domain comparer is substituted (NSubstitute), so each test checks one mapping decision (for
  example, "Recast" becomes a recast policy, or PMI applies only below 20% down).
- **Sociable tests:** a request in, the reference numbers out, through the real engine.
- **Validators:** every rule at its boundaries.
- **An architecture test:** no contract exposes a domain type.

**Infrastructure**
- The repository on a real SQLite database built by the real migrations: each owner sees only their own
  calculations, every input survives the round trip, newest first, and search is case-insensitive and literal.
- **The migrations match the model** (`HasPendingModelChanges`): forget `dotnet ef migrations add` and this fails.
- **Stored format** (`StoredFormatTests`): a save of each kind, in today's JSON (`StoredFormats/*.json`, every
  option set), must still load with every value. Adding a field passes; renaming or removing one fails and names
  it. That is the signal to keep the old name, or to add a version to the stored JSON and upgrade it on load.

**API integration**
- The real pipeline in Production mode, on a temporary SQLite file, with one shared host (`[SetUpFixture]`).
- Accounts end to end: sign-up, cookie flags, confirmation and reset through the captured emails, sign-out.
- Saved-calculation CRUD: 201 + Location, 401 when signed out, another user's item is a 404.
- Errors: JSON paths in 400s, malformed bodies, and a substitute service that throws to prove a 500 leaks nothing.
- Swagger, health, the JSON 404 for unknown API routes.

**Angular (Jest)**
- Every component and service: form-to-request mapping, derived values, validation messages, restoring a saved
  request, the shared loan.
- Timing: `switchMap` cancelling and recovering, the debounce.
- Chart configurations (through the fake chart factory).
- ProblemDetails messages.

**End-to-end (Playwright)**
- **Accessibility** (`e2e/accessibility.spec.ts`): axe scans every page and results tab against WCAG 2.2 A and AA, in
  light and dark mode, on desktop and a phone, signed in and out, with every form section open. A failure names
  each rule broken and the elements that break it. Automated scans catch about a third of real problems (contrast,
  missing names and roles, invalid structure); keyboard paths are covered by the other specs, and a screen-reader
  pass still needs a person.
- The real browser, the real API (a scratch database), through page objects and fixtures.
- The calculator, the shared loan between pages, ARMs and buydowns, refinance, pay off or invest.
- Sign-up with the email from the dev mailbox, password reset, saving and reopening all three kinds from History.
- A consistency suite checks every number on the Pay off or invest page against the API response it came from.

## Test standards, enforced by the build

`MortgageAnalytics.Conventions.Tests` parses every C# test file with **Roslyn**, and every Playwright spec with a
regex, and fails listing each violation as `file:line`:

1. **Constraint model only:** `Assert.That(...)`, never `Assert.AreEqual`.
2. **Every assertion has a message** explaining what a failure means, in C# and in Playwright
   (`expect(actual, 'message')`).
3. **More than one assertion in a test means `Assert.Multiple`**, so one run reports every failure, not just the
   first.

They catch real slips: while adding `StoredFormatTests`, rule 3 failed the build until the setup check moved
inside `Assert.Multiple`.

### Supporting conventions

- **Builders, not copy-paste:** `A.Request.FivePercentDown().WithMonthlyExtra(300).WithHousingCosts(c => c.AsHomestead())`
  (`tests/MortgageAnalytics.Testing/Builders/`).
- **One source of expected values:** `ReferenceLoans`, `ReferenceRefinances`, `ReferenceStrategies`, shared by every
  layer.
- **Base classes:** `AmortizationTestBase`, `ValidatorTestBase`, `SociableAnalysisTestBase`, `RepositoryTestBase`,
  `ApiTestBase`.
- **NSubstitute for every double**, `FakeTimeProvider` for the clock: no hand-written fakes.
- **No retries in Playwright:** a flaky test should fail loudly and be fixed, not be hidden by a second attempt.

## Independent models

| Model | Checks | Run |
|---|---|---|
| `tools/rate-check/rate_model.py` | ARM resets, caps, margin, worst case; buydown payments and subsidies | `python tools/rate-check/rate_model.py` |
| `tools/calculator-check/compare_with_api.py` | 300 random purchases and 300 refinances against the live API: every monthly row, cost, total, date, projection year and saving | API on :5080, then run it: expect all identical |
| `tools/strategy-check/strategy_model.py` | Every strategy, scenario and year | `python tools/strategy-check/strategy_model.py` |
| `tools/strategy-check/compare_with_api.py` | 300 random households (seeded) against the live API, every field | API on :5080, then run it: expect "300 identical" |

They are written from the rules, not translated from the C#. If the code and the model were both translated from
the same misunderstanding, they would agree and prove nothing.

## Coverage

| | Lines | Branches | Gate |
|---|---|---|---|
| Backend | ~98% | ~95% | CI fails below 85% (ReportGenerator summary + `jq`) |
| Angular | ~99% | ~90% | `npm test` fails below 85% (`jest.config.js` `coverageThreshold`) |

Coverage is a floor, not a goal: it tells you what is *unchecked*, not that what's checked is right. The
independent models do that job.

## The CI pipeline (`.github/workflows/ci.yml`)

On every push to `main` and every pull request:

```
backend   ─┐  dotnet restore → build (Release, warnings as errors) → test with coverage → report → 85% gate
           ├─► e2e     npm ci → ng build → install Chromium → Playwright (starts API + Angular itself)
frontend  ─┘           (runs only if backend and frontend pass)
           └─► docker  docker build (runs if backend passes)
```

Coverage reports and, on failure, the Playwright report (with traces and screenshots) are uploaded as artifacts.

## Code-quality settings that act like tests

- **Warnings are errors**, with the recommended .NET analyzers on (`AnalysisLevel latest-recommended`).
- **Missing XML docs are errors** on production code (CS1591), so every public member is documented.
- **Nullable reference types** everywhere.
- **NUnit.Analyzers** and **NSubstitute.Analyzers** catch test-code mistakes at compile time.
- **TypeScript strict mode** in the Angular app.
