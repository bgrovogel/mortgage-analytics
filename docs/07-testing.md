# 7. Testing and quality

About 1,310 automated tests in seven suites, written test-first, with the standards enforced by the build.

| Suite | Count | Tools | Speed |
|---|---|---|---|
| Domain | 436 | NUnit | < 1 s |
| Application | 206 | NUnit, NSubstitute, `FakeTimeProvider` | < 1 s |
| Infrastructure | 18 | NUnit, SQLite in memory | ~1 s |
| API integration | 73 | NUnit, `WebApplicationFactory`, NSubstitute | ~2 s |
| Conventions | 7 | NUnit, Roslyn, regex | < 1 s |
| Angular unit | 485 | Jest, jest-preset-angular | ~10 s |
| End-to-end | 86 | Playwright (Chromium), axe-core | ~30 s, with the production build |

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
- **The contract itself:** `ContractSnapshotTests` compares the OpenAPI document (its shape, without the prose)
  with `Snapshots/openapi.v1.approved.json`. Any change of a path, property, type or enum value fails in seconds and
  writes `openapi.v1.received.json` beside it: diff the two, update the TypeScript models, then copy received over
  approved. Renaming one field's JSON name compiles and passes the C# tests that share the types; this catches it.

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
- The real browser on the **production build, served by the real API** (a scratch database), as the container
  serves it, through page objects and fixtures. So every test runs under the API's Content-Security-Policy, and an
  automatic fixture (`withinContentSecurityPolicy`) fails any test in which the browser blocked something; the Angular
  dev server sends no CSP, so tests run against it would never notice. `security.spec.ts` checks the page carries
  the policy.
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
4. **Every Playwright spec takes `test` from `e2e/fixtures.ts`**, so checks shared by every test (the
   Content-Security-Policy guard) cannot be skipped by importing from `@playwright/test` directly.

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

## Dependency audit

CI fails on any known vulnerability in what ships: `dotnet list package --vulnerable --include-transitive` for
every NuGet package, and `npm audit --omit=dev` for the browser's dependencies. Both are clean.

The full `npm audit` reports one moderate advisory, 21 times over: `sprintf-js` (GHSA-hp3w-g68c-fv3c, a denial of
service through huge precision specifiers), reached through Jest's coverage instrumentation (`babel-plugin-istanbul`
→ `js-yaml` 3 → `argparse` 1). It is accepted, for three reasons: no fixed `sprintf-js` exists (1.1.3 is the latest,
and affected); `js-yaml` 3 loads `argparse` only in its command-line tool, never in the library Istanbul calls, so
the code never runs here; and it is a test tool that never ships. Forcing `argparse` 2 in with an `overrides` entry
would silence the report by breaking `js-yaml`'s command-line tool, which is a worse trade. Look again when Istanbul
moves to `js-yaml` 4.

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

## Mutation testing

**Stryker.NET** measures the domain tests' strength rather than their reach. It makes about 890 small changes
(mutants) to `MortgageAnalytics.Domain` (`<` to `<=`, `+` to `-`, `Sum` to `Max`, an emptied message, a deleted
statement) and runs the tests against each. A mutant no test notices *survives*, and points at an assertion that is
missing. **The score is 97.4%; CI fails below 95%** (`tests/MortgageAnalytics.Domain.Tests/stryker-config.json`), and
uploads the HTML report.

The first run scored 87%, with 118 survivors. They sorted into:

- **Untested guard limits.** `if (interval is < 1 or > 120)` survived becoming `>= 120`; seven of `Household`'s guards
  could be deleted outright; many guard messages were never read. `GuardLimitTests` now has one row per limit: the
  limit itself is accepted, and just past it is rejected with that guard's own message.
- **Behaviour no test pinned.** An ARM without a margin falling to its lifetime floor, the periodic cap after the
  first reset, an annual extra from payment 3 (from payment 6, `p − 6` and `p + 6` land on the same payments), an ARM
  loan already being paid, the buydown cost at closing, a refinance that never breaks even, ESPP money in the IRA share.
- **Code that could never change a result**, now removed: `RecastPolicy`'s `> 0` (the minimum is always positive),
  `MonthlyCashPlan`'s `AfterTaxShare > 0` (at least 0.4 under the 60% cap), a balance check in the first year's
  interest, and optional `null`s nobody passed.
- **Equivalent mutants**, which no test can kill because they behave identically: `>>=` and `>>>=` on a non-negative
  number, `First()` and `FirstOrDefault()` on a list that always has three entries, a `>=` that only differs on an
  exact-to-the-cent tie. The 23 survivors are all of this kind.

## The CI pipeline (`.github/workflows/ci.yml`)

On every push to `main` and every pull request:

```
backend   ─┐  dotnet restore (locked) → build (Release, warnings as errors) → no vulnerable packages → test with coverage → report → 85% gate
           ├─► e2e     npm ci → install Chromium → Playwright (builds the app, serves it from the API, as in production)
frontend  ─┘           npm ci → npm audit (shipped deps) → lint → Jest with coverage; e2e runs only if backend and frontend pass
           └─► docker  docker build → run the image → /health is Healthy, the app is served with its CSP,
                       and the calculator answers (runs if backend passes)

docs      counts the tests (dotnet --list-tests, playwright --list, Jest) → every count in README and docs/ matches
mutation  Stryker.NET on the domain → fails below a 95% mutation score, uploads the report
```

The test counts in these pages are checked, not trusted: `tools/doc-check/doc_counts.py` holds one rule for each
place a count appears and fails CI naming the file and line of any that is stale. A "N ... tests" phrase that no rule
covers fails too, so a new count cannot slip past it.

NuGet packages are cached on the `packages.lock.json` files, and npm packages on `package-lock.json`.
Coverage reports and, on failure, the Playwright report (with traces and screenshots) are uploaded as artifacts.

## Code-quality settings that act like tests

- **Warnings are errors**, with the recommended .NET analyzers on (`AnalysisLevel latest-recommended`).
- **Missing XML docs are errors** on production code (CS1591), so every public member is documented.
- **Nullable reference types** everywhere.
- **NUnit.Analyzers** and **NSubstitute.Analyzers** catch test-code mistakes at compile time.
- **TypeScript strict mode** in the Angular app.
