# Mortgage Analytics

A home-purchase and mortgage analysis engine. It builds fixed-rate amortization schedules, compares
paying off early against **recasting**, and includes the full monthly cost of ownership:
**school, county/city and MUD taxes (with homestead exemptions and the appraisal cap), PID
assessments, homeowners insurance, PMI and HOA dues**. It then projects all of those costs year
by year over the life of the loan, so an owner can see where their payment is heading, not just
where it starts.

It also compares **refinancing** with keeping the current loan, including the trap most calculators
hide: a lower payment can cost more overall, because a new 30-year loan restarts the amortization
clock. And it answers the question every owner with spare cash asks: **pay the mortgage off, or invest
the difference?** It plays three strategies out month by month for 30 years, with the 401(k) match, IRA,
RSUs, ESOP, ESPP, taxes and the standard deduction, and ranks them on a risk-adjusted return, because
paying down a mortgage earns its rate for certain and the market does not. With a free **account**, every calculation and refinance comparison can be saved under a name
in a private **History** (SQLite), and found and reopened later. The calculators themselves need no account.

It is a .NET 9 API with an Angular 19 dashboard, tested from pure unit tests up to browser E2E.

It is small on purpose. The domain (exact money math, prepayment rules, lender recast rules, PMI
cancellation) is rich enough to show real engineering judgment, while the codebase stays small enough to read in one sitting.

| | |
|---|---|
| **Backend** | ASP.NET Core 9 minimal APIs · FluentValidation · EF Core + SQLite (migrations) · ASP.NET Core Identity (cookie sessions, email confirmation, password reset) · MailKit · Swagger / OpenAPI · RFC 9457 ProblemDetails |
| **Frontend** | Angular 19 (standalone components, signals, typed reactive forms, OnPush, router) · Chart.js |
| **Tests** | NUnit + NSubstitute: 572 backend tests · Jest: 360 Angular unit tests · Playwright: 48 E2E tests · coverage gated at 85% |
| **Delivery** | Multi-stage Dockerfile (single container) · GitHub Actions CI |

---

## What it calculates

| Feature | How it works |
|---|---|
| **Purchase** | Home price + down payment → loan amount, down-payment %, loan-to-value. |
| **Principal & interest** | Standard annuity formula in `decimal`, with interest rounded to cents each month. The final payment absorbs rounding drift, so every schedule ends at exactly $0.00. |
| **Extra payments** | Monthly, annual and one-time lump sums, in any combination. An extra payment that exceeds the remaining balance is capped. |
| **Recasting** | A lender recasts only after a **single payment of at least its minimum** (default $10,000, never below $1,000) and charges a fee (default $250). Several smaller payments in one month do not add up to a qualifying one. A recast keeps the payoff date and re-amortizes to a lower payment; smaller extra payments still shorten the term. Each recast is recorded with the old payment, new payment and fee. |
| **Property taxes** | Three taxing units, each an annual rate on the home's taxable value: **school**, **county/city/other** and **MUD**. Texas "per $100 of valuation" rates are entered as-is ($0.85 per $100 = 0.85%). Each year's bill is split into twelve installments that add up to the bill exactly. |
| **Homestead exemptions** | For a primary residence, the **school** tax exempts a fixed amount ($140,000 in Texas), and **county/city** tax can exempt a percentage (up to 20% in Texas, and never less than $5,000: Tax Code §11.13(n)). The school exemption deliberately does **not** reduce county, city or MUD tax, which matches the law. A MUD may offer its own percentage exemption; this app has no MUD exemption input, so MUD tax is charged on the full assessed value. |
| **Over 65 or disabled** | For a homestead, from the year the owner qualifies: an **extra school exemption** ($60,000 in Texas since 2025) and a **school tax ceiling** that freezes school tax at that year's amount. It can fall but never rise. Counties and cities may add their own extra exemption and ceiling. |
| **Appraisal cap** | A homestead's *taxable* value may rise at most a set percentage a year (10% in Texas), even when market value rises faster. |
| **Future increases** | Home value growth drives each year's tax bill (subject to the cap); insurance and HOA dues rise by their own yearly rates. Defaults are long-run US averages, cited in the form: home values +4.3% a year (FHFA House Price Index, 1975–2025), home insurance +4.8% a year (GAO-26-107867: average premium $2,235 in 2019 to $2,829 in 2024), HOA dues +4% (typically 3–5%). |
| **Yearly projection** | Market value, the cap-limited assessed value, **what each tax is actually charged on** (school after its homestead exemption, county/city after its own, MUD in full), and every cost category, for each year of the term. Costs are a stacked area (the top edge is the yearly total). |
| **PID assessment** | A fixed annual amount, optionally ending after the district's remaining years. |
| **Insurance & HOA** | An annual premium and monthly dues. |
| **PMI** | Required only with **less than 20% down**. The premium is a percentage of the *original* loan. Two removal paths, as the Homeowners Protection Act defines them: **automatic at 78%**, measured on the *original* amortization schedule (extra payments do not move it), or **on request at 80%**, which may use the *actual* balance (extra payments bring it forward, and that PMI saving counts toward net savings). |
| **Savings** | **Net savings = interest saved + PMI saved − recast fees.** Taxes, insurance and dues are deliberately excluded, because they continue after the loan is paid off. |
| **Refinance** | The rest of the current loan against the new one, with closing costs paid at closing or rolled into the loan. Reports the monthly change, **lifetime savings (closing costs included)**, the months added by restarting the clock, and a **break-even**: the payment by which the interest saved covers the closing costs. That counts financed costs too, unlike the usual "costs ÷ monthly savings". When the new payment is lower it also shows the new loan **paid at today's payment**, which is how to refinance without restarting the clock. |
| **Pay off or invest** | Three strategies: **Debt free ASAP** (every extra dollar to principal, then everything invested), **Invest the difference**, and a **Hybrid**. Every strategy first captures free money (the full 401(k) match, at its after-tax cost, and any ESPP discount), so only the cash left over is directed differently, and all three spend exactly the same each month. Each runs at the expected return, at a **risk-adjusted** return (expected minus 4, 2 or 0 points for a Conservative, Balanced or Aggressive profile), and with a **lost decade first** (−1% a year, like 2000–2009). The recommendation rests on the risk-adjusted return and always says whether a bad decade would reverse it. Mortgage interest saves tax only on itemized deductions **above the standard deduction** (2026 amounts, rising with inflation; $750k debt limit), year by year, so paying down early also shrinks the deduction. Net worth counts every account **after the tax still owed** (401(k) at the income tax rate, capital gains on taxable growth, Roth free). The hybrid splits extra cash by the after-tax rate difference (invested cash earns the full return inside the IRA, and in a taxable account keeps what is left after tax paid once, on selling), counting **stock that arrives anyway** (RSUs kept, ESOP) toward its market share, so someone already heavy in company stock leans to the mortgage. Results: the recommendation and three cards (each led by how far it ends behind the leader), then tabs for the difference over time, net worth at years 5, 10, 15 and 30 (also in today's dollars), debt vs. investments, and why. |
| **Accounts & History** | Sign up with an email and password, and confirm the email from the link sent to it; a forgotten password is reset by email. Save any calculation or refinance comparison under a name; search and filter by kind, reopen it on its own page (the form is restored exactly), rename or delete it. Each person sees only their own. |

---

## Quick start

### Option 1: Docker (one command)

```bash
docker compose up --build
```

- App: http://localhost:8080
- API docs (Swagger UI): http://localhost:8080/swagger
- **Email inbox (Mailpit): http://localhost:8025**. Confirmation and password-reset emails land here;
  nothing leaves your machine.
- Accounts, saved calculations and the keys that sign sessions and emailed links live on the
  `mortgage-analytics_calculations` volume, so they survive restarts.

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

**Accounts work locally with no mail server.** Without SMTP settings the API writes emails to a local
outbox, and in Development the app shows them at **http://localhost:4200/dev/mailbox** (the sign-up and
forgot-password screens link to it). Open the email, click its link, done. *Clear* empties it before a demo.
The mailbox exists only in Development, because it shows everyone's links.

To send real email, set `Email:Smtp:Host`, `Port`, `Username` and `Password` (user secrets or environment
variables, e.g. `Email__Smtp__Host`), and `Email:From`.

**Visual Studio / Rider:** open `MortgageAnalytics.sln`. Every project is in the solution, the
Angular app included (`client/client.esproj`), and repository files appear under *Solution Items*.
Set **MortgageAnalytics.Api** and **client** as multiple startup projects to run both with F5.

### Running the tests

```bash
dotnet test                       # 572 NUnit tests, including the convention tests

cd client
npm test                          # 360 Jest unit tests; fails below 85% coverage
npm run e2e:install               # first time only: downloads Chromium
npm run e2e                       # 48 Playwright tests; starts the API and Angular for you
```

Backend coverage report (the same gate CI applies):

```bash
dotnet tool restore
dotnet test --collect:"XPlat Code Coverage" --results-directory ./coverage
dotnet reportgenerator -reports:"coverage/**/coverage.cobertura.xml" -targetdir:coverage/report -reporttypes:Html
```

---

## Using the API

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/amortization/calculate` | The purchase analysis below (`?includePayments=false` for summaries only) |
| `POST /api/v1/refinance/analyze` | Keep the current loan or refinance it |
| `POST /api/v1/strategies/compare` | Pay off first, invest the difference, or a hybrid, in three market scenarios |
| `POST /api/v1/account/register` · `login?useCookies=true` · `logout` | Create an account (a confirmation email is sent), sign in (session cookie), sign out |
| `GET /api/v1/account/confirmEmail` · `POST resendConfirmationEmail` | Confirm the email with the code from the link; send the link again |
| `POST /api/v1/account/forgotPassword` · `resetPassword` | Email a reset link; set a new password with its code |
| `GET` · `DELETE /api/v1/dev/outbox` | **Development only:** the local outbox, and emptying it |
| `GET /api/v1/account/manage/info` | Who is signed in (401 when nobody is) |
| `GET /api/v1/calculations?search=` 🔒 | Your saved calculations, newest first, filtered by name |
| `GET /api/v1/calculations/{id}` 🔒 | One of them |
| `POST /api/v1/calculations` 🔒 | Save calculator `inputs` or a `refinance` comparison under a name (201 with `Location`) |
| `PUT /api/v1/calculations/{id}` 🔒 | Rename it or replace its inputs |
| `DELETE /api/v1/calculations/{id}` 🔒 | Delete it (204) |

🔒 needs a signed-in user (401 otherwise). Another user's calculation is a **404**, not a 403, so the
API never confirms that it exists.

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
    "localTaxRate": 1.1,
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
┌──────────────────────────────┐      ┌──────────────────────────────────────────────────────────┐
│  Angular client (router)     │      │  MortgageAnalytics.Api   (HTTP only)                     │
│  /calculator                 │ HTTP │   endpoints · ValidationFilter<T> · exception handler    │
│    overview · projection ·   ├─────►│   Swagger · health check · serves the SPA in production  │
│    schedule (routed tabs)    │      ├──────────────────────────────────────────────────────────┤
│  /refinance · /strategy      │      │  MortgageAnalytics.Application   (use cases)             │
│  /history                    │      │   contracts · validators · mapping · services · ports    │
│  stores: CalculatorStore,    │      ├────────────────────────────┬─────────────────────────────┤
│  Refinance/StrategyStore     │      │  MortgageAnalytics.Domain  │  MortgageAnalytics.         │
└──────────────────────────────┘      │  (no dependencies at all)  │  Infrastructure             │
                                      │  Loans · ExtraPayments ·   │  EF Core + SQLite: the      │
                                      │  Amortization · Housing-   │  saved-calculations         │
                                      │  Costs · Refinancing ·     │  repository, migrations     │
                                      │  Strategies                │                             │
                                      └────────────────────────────┴─────────────────────────────┘
```

Dependencies point inward only: **Api → Application → Domain**, and **Infrastructure → Application**.
The Application layer owns the `ISavedCalculationRepository` port; Infrastructure implements it with
EF Core, so neither the domain nor the use cases know a database exists. The domain references no NuGet
packages and no ASP.NET types, so the financial logic can be tested, and reused, in isolation.

```
src/MortgageAnalytics.Domain/
  Loans/            LoanTerms, PropertyPurchase (down payment, LTV, PMI requirement), PaymentFormula
  ExtraPayments/    IExtraPaymentRule → Monthly / Annual / LumpSum; ExtraPaymentPlan (composite)
  Amortization/     AmortizationCalculator, RecastPolicy, RecastEvent, LoanComparer, LoanComparison
  HousingCosts/     IHousingCost → ValueBasedTax / AnnualFixedCost / MonthlyFixedCost / MortgageInsurance;
                    PropertyValuation (growth + appraisal cap), TaxExemption, SeniorTaxRelief, Installments;
                    HousingCostPlan (composite), HousingCostBreakdown, HousingCostSchedule (monthly + yearly)
  Refinancing/      RefinanceOffer, RefinanceAnalyzer, RefinanceAnalysis (savings, months added, break-even)
  Strategies/       StrategyOptimizer (3 strategies x 3 market scenarios), StrategySimulator (month by month),
                    MonthlyCashPlan (free money first), StrategyRates (after-tax rates, hybrid split),
                    TaxDeductions (standard deduction, $750k limit), InvestmentAccounts (after-tax value)
src/MortgageAnalytics.Application/   Contracts, validation, mapping, services, the repository port, DI wiring
src/MortgageAnalytics.Infrastructure/ CalculationsDbContext, SavedCalculationRepository, Migrations/
src/MortgageAnalytics.Api/           Program.cs, endpoints, filters, error handling
tests/
  MortgageAnalytics.Testing/        Shared test data: A.Request builder, ReferenceLoans, ReferenceRefinances, ReferenceStrategies, TestClock
  MortgageAnalytics.Conventions.Tests/  Checks that every test (C# and Playwright) follows the assertion standards
  MortgageAnalytics.Domain.Tests/   321 tests
  MortgageAnalytics.Application.Tests/  174 tests (unit with NSubstitute, sociable scenarios, architecture)
  MortgageAnalytics.Infrastructure.Tests/  12 tests (real SQLite, built by the real migrations)
  MortgageAnalytics.Api.IntegrationTests/  59 tests (shared WebApplicationFactory fixture, temp SQLite file)
client/  src/app/core (models, API services, state, forms, charts) · src/app/features/{calculator,refinance,strategy,history} · e2e/
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
  recast, and lenders recast only after one qualifying payment. The calculator compares the period's
  *largest single* prepayment with `RecastPolicy`'s minimum, not the month's total, so $200 a month plus a
  $9,900 lump sum does not recast. The tests pin the boundary: $9,999.99 does not recast; $10,000 does.
  A zero minimum is rejected, because every routine extra payment would trigger a recast and its fee.
- **PMI removal follows the law.** Automatic removal at 78% is measured on the original schedule, so
  extra payments do not change it. A borrower's request at 80% may use the actual balance, so extra
  payments bring it forward, and only that PMI saving counts toward net savings. Each cost period
  therefore carries both balances: the actual one and the original schedule's.
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
| **KISS / YAGNI** | No MediatR or AutoMapper: nothing here needs them. The Infrastructure project and the repository arrived only with the first real need, saved calculations. Inputs are stored as one JSON column, because they are only ever read and written whole. |

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

Accounts follow the same habit of not trusting the client:

- **Session in an HttpOnly, SameSite=Strict cookie**, so scripts cannot read it and other sites cannot
  send it (no token in `localStorage`). Passwords are hashed by Identity; repeated failures lock the account.
- **Ownership is enforced in the query** (`WHERE OwnerId = @user`) in the repository, not by checking
  afterwards, and a deleted account takes its calculations with it (foreign key, cascade).
- **An account belongs to a real inbox:** sign-in waits for the emailed confirmation. "Forgot password"
  and "resend" answer the same whether or not the address has an account, so they cannot be used to find
  out who is registered. Emailed codes are single-purpose, expire, and are signed with keys that are kept
  on disk, so links (and sessions) survive a restart.
- **Sign-in only returns to paths on this site** (`/history`, never `//evil.example`), so it cannot be
  turned into an open redirect.

### API

- **Minimal APIs** with `TypedResults`, so OpenAPI response types are inferred from the code.
- **Versioned route** (`/api/v1/...`).
- **ProblemDetails for every error**: validation (400, with readable field names keyed by JSON path),
  unreadable bodies (their own status: 400, 413, ...), unknown API route (404), and server-side failures
  (500 with a generic title, logged). A broken domain rule is a 500 too: input is validated first, so it
  means a bug, and its internal message is never shown.
- **Contracts own their types.** Request and response types never expose Domain types (an architecture
  test enforces it), so renaming something in the domain cannot silently change the public API.
- **Response size is the client's choice.** `?includePayments=false` drops the up-to-1,200 monthly rows
  and keeps every summary and the yearly projection.
- **Source-generated logging** (`[LoggerMessage]`), and the code builds with the recommended .NET analyzers.
- **One container**: the API serves the compiled Angular app from `wwwroot`. That means one port,
  one deployment, and no CORS.

### Frontend

- **Pages and routed tabs.** Calculator, Refinance, Pay off or invest, and History are pages; the calculator's results are
  Overview, Projection and Schedule tabs with their own URLs (bookmarkable, back button works). Root
  stores hold each page's state, so moving between pages never loses a calculation.
- **One debounced-request helper.** `latestRequest` (debounce, `switchMap`, per-request error recovery,
  busy until the latest answer) backs the calculator, the refinance comparison and the strategy comparison.
- **A schedule you can make your own.** Lifetime totals for every cost above the table, and a Columns
  picker to show any category (school tax, PMI, HOA...) as its own column with its own total.

- **Five fields up front, the rest one click away.** Price, down payment, rate, term and the monthly
  extra are always visible. Taxes, insurance/HOA/PMI, future increases and other payment options sit in
  collapsible sections, each summarized in one line ("School 1% · County/city 1.1% · MUD 0.85% ·
  Homestead"). A closed section that holds an invalid value says so, so a problem is never hidden.
- **Results update as you type.** Every valid change produces a request. The page waits for a 400 ms
  pause, cancels stale requests with `switchMap`, and stays `aria-busy` until the *latest* change is
  answered (an older response arriving mid-typing does not end the busy state).
- **One headline number.** With extra payments, net savings is the full-width hero tile and a Total
  interest tile shows the new total against the original. Without them, the headline is the total interest
  over the loan, never a $0 saving. On phones a sticky bar keeps the payment and savings in view.
- **Number boxes that read like money.** A small `appNumber` directive (a `ControlValueAccessor` and
  validator) shows "375,000" with the $ or % inside the box, switches to the plain number while you
  edit, selects it on focus so typing replaces it, and marks unreadable text invalid instead of reading it as 0.
- **Answer first on a phone.** The reading order is headline numbers, then the form, then the
  detail; on wider screens a CSS grid moves the form into its own column on the left.
- **One chart card, three tabs.** Balance, yearly costs and home value share a card that follows the
  WAI-ARIA tabs pattern (arrow keys, Home/End, one tab in the tab order). X-axis labels are chosen in
  code (`tickIndices`) so the last point is always labelled, on whole years for monthly data.
- **A schedule you can scan.** Monthly or yearly rows, totals under each column, and the # and Date
  columns pinned while the table scrolls sideways on a phone (a fade shows there is more).
- **Down payment in dollars or percent.** A $ | % switch converts the value; the API always receives dollars.
- **The form scrolls on its own.** The results column is much longer, so the form panel is capped to the
  window and scrolls independently, keeping every section toggle reachable.
- **Container / presentational split.** `CalculatorPageComponent` owns state and HTTP, and its
  presentational children take inputs and emit outputs.
- **Signals + OnPush** throughout, with a typed form. Loan amount, down-payment % and whether PMI
  applies are computed live from the form.
- **`switchMap` with per-request error handling.** A newer calculation cancels a stale one, and a
  failed request does not break later ones (an E2E test covers this).
- **Accessible charts.** The payment breakdown is a stacked bar with a labelled table, and the line
  charts have legends, crosshair tooltips and a one-line written takeaway. On the balance chart the gap
  between the two payoffs is shaded, so the time and interest saved show up as an area. The schedule table doubles
  as the data view. Taxable value is dashed, so it stays visible when it overlaps market value. Colors come from a colorblind-safe palette validated in both light and dark mode, and are
  fixed per category so they never shift between results.

---

## Testing strategy

| Layer | Tools | What it proves |
|---|---|---|
| Domain (321) | NUnit | Payment formula against known values. Invariants for every loan shape ($0.00 ending, principal sums to the loan, whole cents, a balance that never rises). Every guard, identified by its message. Exemptions, the appraisal cap, installments summing exactly, over-65 ceilings, PMI at 78% and 80%, recast boundaries and fees. Refinance savings, months added and break-even against independent reference values. Every strategy, scenario, payoff, crossover and 30-year net worth against an independent Python model, to the cent, and against textbook formulas and identities (payoff month = NPER; at a 0% return, paying off first wins by exactly the interest it avoids; net worth = home − mortgage + investments every year); the standard deduction, the $750k limit, free money capped by the cash available, the ESPP limit, the hybrid split, after-tax account values. |
| Application (174) | NUnit + NSubstitute + FakeTimeProvider | **Unit:** the domain comparer is substituted, so each test checks one mapping decision (strategy to recast policy, defaults, PMI only below 20% down, zero amounts treated as none). **Sociable:** request in, reference numbers out, through the real engine. Validator rules and boundaries. |
| Infrastructure (12) | NUnit + SQLite in memory | The repository on a real database built by the real migrations: each owner sees only their own calculations, every input (both kinds) survives the round trip, newest-first order, case-insensitive literal search, a check that the migrations match the model. |
| API integration (59) | NUnit + WebApplicationFactory + NSubstitute | The real pipeline in Production mode, on a temporary SQLite file: accounts (sign up, cookie flags, wrong password, password rules, sign out), email confirmation and password reset end to end through the captured emails, the dev mailbox only in Development, the email links and SMTP message format, saved-calculation CRUD as a signed-in user (201 + Location, 404 problems, 401 when signed out, another user's items are 404), refinance, strategy comparison (enum names in and out), JSON binding, camelCase error paths, malformed bodies, `includePayments=false`. Error handling, with a substitute service that throws: 500 with no details for any server-side failure (including a broken domain rule), and a bad request keeps its own status (400, 413). Swagger, health, the 404 for unknown API routes. |
| Conventions (6) | NUnit + Roslyn + regex | The test standards themselves (below), for the C# tests and the Playwright specs. An architecture test also checks that API contracts never expose Domain types. |
| Angular (360) | Jest + jest-preset-angular | Every component and service: form-to-request mapping, derived values, validation, the switchMap cancel/recover behaviour, chart configuration (through an injected fake chart factory), ProblemDetails messages. |
| End-to-end (48) | Playwright | Real browser and real API (on a scratch database), through page objects and fixtures (each History test runs as a brand-new user): the calculator, sign-up with the confirmation email from the dev mailbox, password reset, sign-out, saving while signed out, saving and reopening both kinds from History, the refinance comparison, and pay off or invest (the recommendation, a bad decade, stock-heavy households, risk profiles), all against the reference numbers. |

**Coverage:** backend 98.5% lines / 94.7% branches (compiler-generated code and migrations excluded); Angular 99.3% lines / 92.4% branches. CI fails if any figure drops below **85%**, so new behaviour arrives with its tests (TDD).

### Test standards, enforced by the build

These are checked by `MortgageAnalytics.Conventions.Tests`, which parses every test file with Roslyn and lists each violation as `file:line`:

1. **Constraint model only:** `Assert.That(...)` and `Assert.Multiple(...)`; no classic asserts.
2. **Every assertion has a message** explaining what a failure means, in C# and in the Playwright
   specs (`expect(actual, 'message')`).
3. **More than one assertion in a method means `Assert.Multiple`**, so one run reports every failure.

And by convention, supported by shared infrastructure:

- **NSubstitute** for test doubles. There are no hand-rolled fakes, and the clock comes from `FakeTimeProvider`.
- **Builders, not copy-paste:** `A.Request.FivePercentDown().WithMonthlyExtra(300).WithHousingCosts(c => c.AsHomestead())`.
- **One source of expected values:** `ReferenceLoans`, `ReferenceRefinances` and `ReferenceStrategies`, independently computed in Python (the refinance values with exact fractions) and shared by every layer. That independence paid off: the refinance reference exposed a half-cent rounding bug in the engine (7% ÷ 12 repeats forever, so interest is now balance × annual rate ÷ 1,200).
- **Base classes:** `AmortizationTestBase`, `ValidatorTestBase`, `AmortizationServiceTestBase` (unit), `SociableAnalysisTestBase`, and `ApiTestBase` with a `[SetUpFixture]` that shares one API host.
- **Central package versions** (`Directory.Packages.props`) and one shared test stack (`tests/Directory.Build.props`).

## What I'd add next

- **Tax rate changes**: per-year rate schedules, and the ceiling transfer when a qualifying owner moves.
- **Equity tracking**: home value minus loan balance, year by year.
- **Closing costs and cash to close**: an upfront-costs summary alongside the down payment.
- **FHA / VA loans**: upfront and annual MIP, and the VA funding fee, as new `IHousingCost` implementations.
- **Adjustable-rate (ARM) loans**: a rate-schedule strategy.
- **Rate limiting** on sign-in and registration, on top of Identity's lockout.
- **Mutation testing** (Stryker.NET) on the domain, to measure how strong the tests are, not just how much they cover.
