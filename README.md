# Mortgage Analytics

A home-purchase and mortgage analysis engine. It builds fixed-rate amortization schedules, compares
paying off early against **recasting**, and includes the full monthly cost of ownership:
**school, county/city and MUD taxes (with homestead exemptions and the appraisal cap), PID
assessments, homeowners insurance, PMI and HOA dues**. It then projects all of those costs year
by year over the life of the loan, so an owner can see where their payment is heading, not just
where it starts.

It is a .NET 9 API with an Angular 19 dashboard, tested from pure unit tests up to browser E2E.

It is small on purpose. The domain (exact money math, prepayment rules, lender recast rules, PMI
cancellation) is rich enough to show real engineering judgment, while the codebase stays small enough to read in one sitting.

| | |
|---|---|
| **Backend** | ASP.NET Core 9 minimal APIs · FluentValidation · Swagger / OpenAPI · RFC 9457 ProblemDetails |
| **Frontend** | Angular 19 (standalone components, signals, typed reactive forms, OnPush) · Chart.js |
| **Tests** | NUnit + NSubstitute: 340 backend tests · Jest: 76 Angular unit tests · Playwright: 16 E2E tests · coverage gated at 85% |
| **Delivery** | Multi-stage Dockerfile (single container) · GitHub Actions CI |

---

## What it calculates

| Feature | How it works |
|---|---|
| **Purchase** | Home price + down payment → loan amount, down-payment %, loan-to-value. |
| **Principal & interest** | Standard annuity formula in `decimal`, with interest rounded to cents each month. The final payment absorbs rounding drift, so every schedule ends at exactly $0.00. |
| **Extra payments** | Monthly, annual and one-time lump sums, in any combination. An extra payment that exceeds the remaining balance is capped. |
| **Recasting** | A lender recasts only after a **single lump sum of at least its minimum** (default $10,000) and charges a fee (default $250). A recast keeps the payoff date and re-amortizes to a lower payment. Smaller extra payments still shorten the term. Each recast is recorded with the old payment, new payment and fee. |
| **Property taxes** | Three taxing units, each an annual rate on the home's taxable value: **school**, **county/city/other** and **MUD**. Texas "per $100 of valuation" rates are entered as-is ($0.85 per $100 = 0.85%). Each year's bill is split into twelve installments that add up to the bill exactly. |
| **Homestead exemptions** | For a primary residence, the **school** tax exempts a fixed amount ($140,000 in Texas), and **county/city** tax can exempt a percentage (up to 20% in Texas). The school exemption deliberately does **not** reduce county, city or MUD tax, which matches the law. |
| **Over 65 or disabled** | For a homestead, from the year the owner qualifies: an **extra school exemption** ($60,000 in Texas since 2025) and a **school tax ceiling** that freezes school tax at that year's amount. It can fall but never rise. Counties and cities may add their own extra exemption and ceiling; MUD tax has none. |
| **Appraisal cap** | A homestead's *taxable* value may rise at most a set percentage a year (10% in Texas), even when market value rises faster. |
| **Future increases** | Home value growth drives each year's tax bill (subject to the cap); insurance and HOA dues rise by their own yearly rates. |
| **Yearly projection** | Market value, taxable value and every cost category for each year of the term, charted as lines. |
| **PID assessment** | A fixed annual amount, optionally ending after the district's remaining years. |
| **Insurance & HOA** | An annual premium and monthly dues. |
| **PMI** | Required only with **less than 20% down**. The premium is a percentage of the *original* loan. It stops when the *actual* balance reaches **78%** of the home's value (automatic removal under the Homeowners Protection Act) or **80%** (when the borrower requests removal). Extra payments end PMI sooner. |
| **Savings** | **Net savings = interest saved + PMI saved − recast fees.** Taxes, insurance and dues are deliberately excluded, because they continue after the loan is paid off. |

---

## Quick start

### Option 1: Docker (one command)

```bash
docker compose up --build
```

- App: http://localhost:8080
- API docs (Swagger UI): http://localhost:8080/swagger

### Option 2: Local development

Prerequisites: .NET 9 SDK and Node 22.

```bash
# Terminal 1: API on http://localhost:5080 (Swagger at /swagger)
dotnet run --project src/MortgageAnalytics.Api

# Terminal 2: Angular on http://localhost:4200 (proxies /api to :5080)
cd client
npm install
npm start
```

**Visual Studio / Rider:** open `MortgageAnalytics.sln`. Every project is in the solution, the
Angular app included (`client/client.esproj`), and repository files appear under *Solution Items*.
Set **MortgageAnalytics.Api** and **client** as multiple startup projects to run both with F5.

### Running the tests

```bash
dotnet test                       # 340 NUnit tests, including the convention tests

cd client
npm test                          # 76 Jest unit tests; fails below 85% coverage
npm run e2e:install               # first time only: downloads Chromium
npm run e2e                       # 16 Playwright tests; starts the API and Angular for you
```

Backend coverage report (the same gate CI applies):

```bash
dotnet tool restore
dotnet test --collect:"XPlat Code Coverage" --results-directory ./coverage
dotnet reportgenerator -reports:"coverage/**/coverage.cobertura.xml" -targetdir:coverage/report -reporttypes:Html
```

---

## Using the API

`POST /api/v1/amortization/calculate`

```json
{
  "homePrice": 375000,
  "downPayment": 18750,
  "annualInterestRate": 6.5,
  "termInMonths": 360,
  "firstPaymentDate": "2026-11-01",
  "strategy": "Recast",
  "recast": { "minimumLumpSum": 10000, "fee": 250 },
  "extraPayments": {
    "monthlyAmount": 200,
    "annual": { "amount": 2000, "firstPaymentNumber": 12 },
    "lumpSums": [{ "paymentNumber": 12, "amount": 25000 }]
  },
  "housingCosts": {
    "schoolTaxRate": 1.0,
    "propertyTaxRate": 1.1,
    "mudTaxRate": 0.85,
    "isHomestead": true,
    "schoolHomesteadExemption": 140000,
    "localHomesteadExemptionPercent": 0,
    "homesteadAssessmentCap": 10,
    "over65OrDisabled": { "qualifiesInYear": 6, "schoolExemption": 60000, "localExemption": 0, "localTaxCeiling": false },
    "homeValueGrowthRate": 4,
    "insuranceIncreaseRate": 5,
    "hoaIncreaseRate": 3,
    "pid": { "annualAssessment": 1200, "remainingYears": 20 },
    "annualHomeownersInsurance": 2400,
    "monthlyHoaDues": 50,
    "pmiRate": 0.5,
    "pmiCancellation": "Automatic"
  }
}
```

The response contains:

- **`purchase`**: the loan amount, down-payment %, loan-to-value, and whether PMI is required.
- **`baseline`** and **`accelerated`** schedules. Each has the monthly payment (principal and
  interest, a housing-cost breakdown, and the all-in total), lifetime totals, the PMI end date,
  any recasts, and every monthly row.
- **`savings`**: interest saved, PMI saved, recast fees, net savings, payments saved, and both payoff dates.
- **`projection`**: one row per loan year with market value, taxable value, and every cost category.

Invalid input returns `400` with field-level errors keyed by JSON path:

```json
{
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "downPayment": ["Down payment must be less than the home price."],
    "housingCosts.pid.remainingYears": ["'PID remaining years' must be between 1 and 50. You entered 99."]
  }
}
```

The full contract, with descriptions and example values, is in Swagger UI at `/swagger`.

---

## Architecture

```
┌───────────────────────────┐      ┌──────────────────────────────────────────────────────────┐
│  Angular client           │      │  MortgageAnalytics.Api   (HTTP only)                     │
│  calculator-page (state)  │ HTTP │   endpoints · ValidationFilter<T> · exception handler    │
│   ├ loan-form             ├─────►│   Swagger · health check · serves the SPA in production  │
│   ├ savings-summary       │      ├──────────────────────────────────────────────────────────┤
│   ├ payment-breakdown     │      │  MortgageAnalytics.Application   (use case)              │
│   ├ balance-chart         │      │   contracts · validators · mapping · AmortizationService │
│   └ schedule-table        │      ├──────────────────────────────────────────────────────────┤
└───────────────────────────┘      │  MortgageAnalytics.Domain   (no dependencies at all)     │
                                   │   Loans · ExtraPayments · Amortization · HousingCosts    │
                                   └──────────────────────────────────────────────────────────┘
```

Dependencies point inward only: **Api → Application → Domain**. The domain references no NuGet
packages and no ASP.NET types, so the financial logic can be tested, and reused, in isolation.

```
src/MortgageAnalytics.Domain/
  Loans/            LoanTerms, PropertyPurchase (down payment, LTV, PMI requirement), PaymentFormula
  ExtraPayments/    IExtraPaymentRule → Monthly / Annual / LumpSum; ExtraPaymentPlan (composite)
  Amortization/     AmortizationCalculator, RecastPolicy, RecastEvent, LoanComparer, LoanComparison
  HousingCosts/     IHousingCost → ValueBasedTax / AnnualFixedCost / MonthlyFixedCost / MortgageInsurance;
                    PropertyValuation (growth + appraisal cap), TaxExemption, SeniorTaxRelief, Installments;
                    HousingCostPlan (composite), HousingCostBreakdown, HousingCostSchedule (monthly + yearly)
src/MortgageAnalytics.Application/   Contracts, validation, mapping, AmortizationService, DI wiring
src/MortgageAnalytics.Api/           Program.cs, endpoints, filters, error handling
tests/
  MortgageAnalytics.Testing/        Shared test data: A.Request builder, ReferenceLoans, TestClock
  MortgageAnalytics.Conventions.Tests/  Roslyn checks that every test follows the assertion standards
  MortgageAnalytics.Domain.Tests/   231 tests
  MortgageAnalytics.Application.Tests/  89 tests (unit with NSubstitute, plus sociable scenarios)
  MortgageAnalytics.Api.IntegrationTests/  16 tests (shared WebApplicationFactory fixture)
client/  src/app/core (models, API service, errors) · src/app/features/calculator · e2e/
```

---

## Design decisions

### Getting the money right

- **`decimal` everywhere, never `double`.** `Math.Pow` works in `double`, so the annuity formula uses
  exponentiation by squaring in `decimal` instead (`PaymentFormula.Pow`).
- **One rounding policy, in one place.** `Money.Round` rounds to cents, half away from zero.
- **Every schedule ends at exactly $0.00.** The final payment absorbs rounding drift, and the tests
  assert this across a range of loan shapes.
- **Independent reference values.** The expected numbers in the tests (payments, total interest,
  PMI end month, recast payment) come from a separate Python `Decimal` implementation, not from
  this code's own output.

### Modelling the real-world rules

- **Down payment is an input; the loan amount is derived.** Asking for a loan amount and a home value
  separately invites them to disagree. `PropertyPurchase` derives the loan, the LTV and whether PMI is
  required, so the 20% rule is written exactly once.
- **Recasts follow lender rules.** A lower payment with the same payoff date only happens through a
  recast, and lenders recast only after a qualifying lump sum. `RecastPolicy.OnLumpSum(minimum, fee)`
  encodes that, and the tests pin the boundary: a $9,999.99 lump sum does not recast; $10,000 does.
- **PMI uses the actual balance.** That is what lets extra payments end PMI early, which is a real and
  often-overlooked saving. 78% (automatic) and 80% (borrower-requested) are both supported.
- **Homestead rules are per taxing unit.** The Texas $140,000 exemption applies only to school
  district tax, so school tax is a separate unit with its own `TaxExemption`. Applying it to the whole
  tax bill would understate taxes by thousands of dollars a year.
- **The over-65 ceiling is set in the qualifying year, not at purchase.** `SeniorTaxRelief` takes the
  loan year the owner turns 65 (or becomes disabled), so a 60-year-old buyer sees normal tax growth for
  five years and then a freeze. The bill is `min(this year's tax, the qualifying year's tax)`, so it can
  still fall with values. The school ceiling always applies by law; the county/city ceiling is a setting.
- **Market value and taxable value are tracked separately.** `PropertyValuation` grows the market value
  and applies the homestead appraisal cap to the taxable value. When the market outruns the cap, the
  owner is taxed on the lower figure, and the "Home value" chart shows that gap directly.
- **Yearly bills add up exactly.** A $5,000 tax bill is collected as eleven installments of $416.67
  and a twelfth of $416.63, never $5,000.04. It is the same rule as the loan's final payment, applied
  in one shared `Installments` helper.
- **Projections follow the full term.** The yearly projection uses the standard schedule, because
  taxes, insurance and dues continue whether or not the loan is paid off early.
- **Savings exclude costs that don't go away.** A shorter loan collects taxes, insurance and dues
  through escrow for fewer months, but the homeowner keeps paying them afterwards. A naive comparison
  would report those as savings. `LoanComparison.NetSavings` counts only interest and PMI, minus
  recast fees, and a test locks that in.

### SOLID, KISS, DRY: where each one shows up

| Principle | Where |
|---|---|
| **Single Responsibility** | `PaymentFormula` does the math, `AmortizationCalculator` builds schedules, `HousingCostPlan` applies costs, `LoanComparer` compares, the validator validates, and endpoints handle HTTP and nothing else. |
| **Open/Closed** | New prepayment kinds are a new `IExtraPaymentRule`, and new ownership costs (flood insurance, special assessments) are a new `IHousingCost`. Neither change touches the calculator. Adding the school tax unit and yearly growth needed no change to the amortization engine. |
| **Liskov Substitution** | Every rule and every cost is interchangeable behind its interface, and the composites (`ExtraPaymentPlan`, `HousingCostPlan`) sum whatever they hold. |
| **Interface Segregation** | Small interfaces with one or two members each: `IExtraPaymentRule`, `IHousingCost`, `IAmortizationCalculator`, `ILoanComparer`, `IAmortizationService`. |
| **Dependency Inversion** | The service depends on `ILoanComparer` and `TimeProvider`, not on concrete classes or `DateTime.Now`, so tests inject a fixed clock. |
| **DRY** | Validation limits come from domain constants. The PMI rule lives only on `PropertyPurchase`. Compounding (`Growth`) and installments (`Installments`) are each written once. One generic `ValidationFilter<T>` serves every endpoint. On the client, one `buildLineChart` and one `hostChart` serve every chart, and one `COST_CATEGORIES` list gives each category the same label and color everywhere. |
| **KISS / YAGNI** | No MediatR, AutoMapper, repository layer or database: nothing here needs them. There is no *Infrastructure* project because there is no infrastructure yet. |

### Documentation is enforced, not hoped for

Every public type and member in the production projects has an XML summary, and
**`Directory.Build.props` makes a missing one a build error** (`CS1591` with `TreatWarningsAsErrors`).
Interface implementations use `<inheritdoc />`, so each contract is described once. The same comments
feed Swagger and IntelliSense. Angular components and services carry JSDoc on their public members.

### Defense in depth

Input is validated **twice, for different reasons**:

1. **FluentValidation** (Application) gives friendly, field-level messages for bad user input.
2. **Guard clauses** (Domain) make invalid objects impossible to construct from *any* caller. If a
   guard ever fires, it is a bug, and the exception handler logs it as one.

The Angular form mirrors the main limits too, which saves a round trip. The server never trusts it.

### API

- **Minimal APIs** with `TypedResults`, so OpenAPI response types are inferred from the code.
- **Versioned route** (`/api/v1/...`).
- **ProblemDetails for every error**: validation (400), malformed JSON (400), unknown API route (404),
  and unexpected failures (500, with no stack trace leaked).
- **Source-generated logging** (`[LoggerMessage]`), and the code builds with the recommended .NET analyzers.
- **One container**: the API serves the compiled Angular app from `wwwroot`. That means one port,
  one deployment, and no CORS.

### Frontend

- **Container / presentational split.** `CalculatorPageComponent` owns state and HTTP, and five
  presentational children take inputs and emit outputs.
- **Signals + OnPush** throughout, with a typed form. Loan amount, down-payment % and whether PMI
  applies are computed live from the form.
- **`switchMap` with per-request error handling.** A newer calculation cancels a stale one, and a
  failed request does not break later ones (an E2E test covers this).
- **Accessible charts.** The payment breakdown is a stacked bar with a labelled table, and the line
  charts have legends, crosshair tooltips and a one-line written takeaway. The schedule table doubles
  as the data view. Taxable value is dashed, so it stays visible when it overlaps market value. Colors come from a colorblind-safe palette validated in both light and dark mode, and are
  fixed per category so they never shift between results.

---

## Testing strategy

| Layer | Tools | What it proves |
|---|---|---|
| Domain (231) | NUnit | Payment formula against known values. Invariants for every loan shape ($0.00 ending, principal sums to the loan, whole cents, a balance that never rises). Every guard, identified by its message. Exemptions, the appraisal cap, installments summing exactly, over-65 ceilings, PMI at 78% and 80%, recast boundaries and fees. |
| Application (89) | NUnit + NSubstitute + FakeTimeProvider | **Unit:** the domain comparer is substituted, so each test checks one mapping decision (strategy to recast policy, defaults, PMI only below 20% down, zero amounts treated as none). **Sociable:** request in, reference numbers out, through the real engine. Validator rules and boundaries. |
| API integration (16) | NUnit + WebApplicationFactory + NSubstitute | The real pipeline in Production mode: JSON binding, camelCase error paths, malformed bodies. Error handling, with a substitute service that throws (422, 500 without leaking details, 400). Swagger, health, the 404 for unknown API routes. |
| Conventions (4) | NUnit + Roslyn | The test standards themselves (below). |
| Angular (76) | Jest + jest-preset-angular | Every component and service: form-to-request mapping, derived values, validation, the switchMap cancel/recover behaviour, chart configuration (through an injected fake chart factory), ProblemDetails messages. |
| End-to-end (16) | Playwright | Real browser and real API, through a page object. |

**Coverage:** backend 99.5% lines / 99.4% branches (compiler-generated code excluded); Angular 100% lines / 94.7% branches. CI fails if any figure drops below **85%**, so new behaviour arrives with its tests (TDD).

### Test standards, enforced by the build

These are checked by `MortgageAnalytics.Conventions.Tests`, which parses every test file with Roslyn and lists each violation as `file:line`:

1. **Constraint model only:** `Assert.That(...)` and `Assert.Multiple(...)`; no classic asserts.
2. **Every assertion has a message** explaining what a failure means.
3. **More than one assertion in a method means `Assert.Multiple`**, so one run reports every failure.

And by convention, supported by shared infrastructure:

- **NSubstitute** for test doubles. There are no hand-rolled fakes, and the clock comes from `FakeTimeProvider`.
- **Builders, not copy-paste:** `A.Request.FivePercentDown().WithMonthlyExtra(300).WithHousingCosts(c => c.AsHomestead())`.
- **One source of expected values:** `ReferenceLoans`, independently computed in Python and shared by every layer.
- **Base classes:** `AmortizationTestBase`, `ValidatorTestBase`, `AmortizationServiceTestBase` (unit), `SociableAnalysisTestBase`, and `ApiTestBase` with a `[SetUpFixture]` that shares one API host.
- **Central package versions** (`Directory.Packages.props`) and one shared test stack (`tests/Directory.Build.props`).

## What I'd add next

- **Tax rate changes**: per-year rate schedules, and the ceiling transfer when a qualifying owner moves.
- **Equity tracking**: home value minus loan balance, year by year.
- **Closing costs and cash to close**: an upfront-costs summary alongside the down payment.
- **FHA / VA loans**: upfront and annual MIP, and the VA funding fee, as new `IHousingCost` implementations.
- **Adjustable-rate (ARM) loans**: a rate-schedule strategy.
- **Persistence**, to save and share scenarios. This would bring an Infrastructure project (EF Core).
- **Mutation testing** (Stryker.NET) on the domain, to measure how strong the tests are, not just how much they cover.
