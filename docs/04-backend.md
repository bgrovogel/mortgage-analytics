# 4. Backend

Four projects under `src/`, read from the inside out: the domain first, because everything else serves it.

## Domain (`src/MortgageAnalytics.Domain`)

Pure C#: no NuGet packages, no ASP.NET, no I/O. Every type is immutable or stateless, so one instance can be
shared across requests.

### The folders

| Folder | Key types | What they do |
|---|---|---|
| (root) | `Money`, `DecimalMath`, `Growth`, `LoanCalendar`, `DomainValidationException` | Rounding to cents (once, here), `decimal` exponentiation, compounding, loan-year arithmetic, and the exception every guard throws |
| `Loans/` | `LoanTerms`, `PropertyPurchase`, `PaymentFormula`, `AdjustableRate`, `RateChange`, `TemporaryBuydown`, `LoanProgress` | The loan itself: its terms and rate changes, the purchase (loan amount, LTV, PMI rule), the payment formula, ARMs and buydowns, and where a loan stands on a given day |
| `ExtraPayments/` | `IExtraPaymentRule`, `MonthlyExtraPayment`, `AnnualExtraPayment`, `LumpSumExtraPayment`, `ExtraPaymentPlan` | Prepayment rules, combined into one plan |
| `Amortization/` | `AmortizationCalculator`, `AmortizationSchedule`, `ScheduledPayment`, `RecastPolicy`, `RecastEvent`, `RateChangeEvent`, `LoanComparer`, `LoanComparison` | The month-by-month engine, recasts, and baseline-vs-accelerated comparison |
| `HousingCosts/` | `IHousingCost`, `ValueBasedTax`, `TaxExemption`, `SeniorTaxRelief`, `PropertyValuation`, `MortgageInsurance`, `AnnualFixedCost`, `MonthlyFixedCost`, `Installments`, `HousingCostPlan`, `HousingCostSchedule` | Taxes (with exemptions, the appraisal cap, the over-65 ceiling), PMI, insurance, HOA, PID; applied month by month and projected by year |
| `Refinancing/` | `RefinanceOffer`, `RefinanceAnalyzer`, `RefinanceAnalysis` | Keep the loan or refinance: savings, months added, break-even |
| `Strategies/` | `StrategyOptimizer`, `StrategySimulator`, `MonthlyCashPlan`, `StrategyRates`, `MortgagePayments`, `TaxDeductions`, `InvestmentAccounts`, `Household`, … | Pay off, invest, or a hybrid, simulated month by month in three market scenarios |

### Patterns you will see, and where

| Pattern | Where | Why |
|---|---|---|
| **Guard clauses** in constructors | `LoanTerms`, `AdjustableRate`, `PropertyPurchase`, … | An invalid object can't exist. `new LoanTerms(-5, …)` throws `DomainValidationException` with a message naming the problem. |
| **Immutable records** | `LoanTerms`, `RecastPolicy`, `AdjustableRate`, events | Value semantics and safe sharing. `with` makes a changed copy: `arm with { Margin = 2.75m }`. |
| **Strategy** (behind an interface) | `IExtraPaymentRule`, `IHousingCost` | Each prepayment kind and each cost is its own small class. |
| **Composite** | `ExtraPaymentPlan`, `HousingCostPlan` | The calculator asks the plan for one total and never knows how many rules or costs there are. |
| **Static factory / named constructors** | `RecastPolicy.Never`, `RecastPolicy.OnLumpSum(...)`, `ExtraPaymentPlan.None` | Intent-revealing creation. |
| **Pure functions** | `PaymentFormula.MonthlyPayment`, `Money.Round`, `Installments` | Same input, same output; trivial to test. |
| **Open/Closed** | Adding a cost or a rule | A new `IHousingCost` (say, flood insurance) is added without changing `AmortizationCalculator`. |

### Money rules (the ones interviewers poke at)

- **`decimal`, never `double`.** `double` can't represent 0.1 exactly, which is fine for physics and wrong for
  cents. `Math.Pow` only works in `double`, so `DecimalMath.Pow` does exponentiation by squaring in `decimal`.
- **One rounding rule, in one place:** `Money.Round` rounds to cents, half away from zero.
- **Interest each month** = balance × annual rate ÷ 1,200, rounded to cents (`LoanTerms.MonthlyInterestOn`). It is
  written that way rather than balance × (rate ÷ 12) because 7 ÷ 12 repeats forever; the independent reference
  found a half-cent difference that this fixed.
- **The final payment absorbs the drift**, so every schedule ends at exactly $0.00.
- **Yearly bills split exactly:** `Installments` makes $5,000 into eleven payments of $416.67 and one of $416.63.

### The engine in one loop

`AmortizationCalculator.Generate(loan, extraPayments, recastPolicy)`, for each period:

1. If the rate changed this period (an ARM reset), re-amortize: new payment = formula(balance, new rate, payments
   left). Record a `RateChangeEvent`.
2. Interest = `MonthlyInterestOn(balance, rate)`.
3. Principal = payment − interest, capped at the balance (the last period takes the whole balance).
4. Extra principal = the plan's amount, capped at what's left.
5. If the period's **largest single** prepayment meets the `RecastPolicy` minimum, re-amortize over the remaining
   term (the payoff date stays, the payment drops). Record a `RecastEvent` with its fee.

ARMs don't change this loop: `loan.WithAdjustableRate(arm)` asks the ARM for its `RatePath()` (a list of
`RateChange`s) from the loan's own rate and term, and attaches it. The loop only asks `loan.AnnualRateFor(period)`.
Every caller (the calculator, both refinance loans, the strategy mortgage, the ARM worst case) goes through that one
method.

## Application (`src/MortgageAnalytics.Application`)

The use cases: what the API offers, and the translation between the outside world and the domain.

| Folder | Contents |
|---|---|
| `Contracts/` | Request and response records: `AmortizationRequest`, `AmortizationResponse`, `RefinanceRequest`, `StrategyRequest`, `SavedCalculation…`. Plain data with XML docs and `<example>` values (they become the Swagger docs). They never expose domain types. |
| `Validation/` | One FluentValidation validator per request. `RateOptionValidators.cs` holds the ARM and buydown rules shared by all three. Limits come from domain constants (`LoanTerms.MaxAnnualInterestRate`), so they are written once. |
| `Mapping/` | Extension methods from contracts to domain objects and back: `request.ToLoanTerms(...)`, `comparison.ToResponse(...)`. `RateOptionMapper` maps ARMs and buydowns the same way for every page. |
| `Services/` | `AmortizationService`, `RefinanceService`, `StrategyService`: map in, call the domain, map out. They depend on interfaces (`ILoanComparer`, `IRefinanceAnalyzer`, `IStrategyOptimizer`) and `TimeProvider`. |
| `SavedCalculations/` | `SavedCalculation` (the entity), `ISavedCalculationRepository` (the port), `SavedCalculationService` (stamps times, trims names, maps). |
| `DependencyInjection.cs` | `AddApplication()`: registers all of the above. |

**Two layers of validation, two purposes.** The validator gives the *user* friendly, field-level messages. The
domain guards protect the *code*: no caller, now or later, can build an invalid loan. If a guard ever fires in
production, input got past the validator, which is a bug, so it is logged and returned as a 500.

**Why the mapping is hand-written.** Each mapping makes decisions (a strategy of "Recast" becomes
`RecastPolicy.OnLumpSum(min, fee)`, a zero amount means "none", PMI applies only below 20% down). Writing them as
code puts those decisions where they can be read and unit-tested one by one, which a mapping library would hide.

## Infrastructure (`src/MortgageAnalytics.Infrastructure`)

| File | Purpose |
|---|---|
| `CalculationsDbContext.cs` | EF Core context: Identity's tables (it derives from `IdentityDbContext`) plus `SavedCalculations` |
| `SavedCalculationRepository.cs` | The port's implementation: list (with a case-insensitive, wildcard-safe search), find, add, update, delete; always filtered by owner |
| `DependencyInjection.cs` | `AddInfrastructure(connectionString)` and `MigrateDatabaseAsync()`, run at startup |
| `Migrations/` | Generated by `dotnet ef migrations add`; never edited by hand |

Details worth knowing:
- **Inputs are JSON columns.** Each kind of inputs (`Inputs`, `Refinance`, `Strategy`) is one column, converted
  with `System.Text.Json` through a `ValueConverter`. The contracts can grow without a schema change. A
  `ValueComparer` compares the JSON, so replacing inputs with an equal copy isn't seen as a change.
- **SQLite can't sort `DateTimeOffset`**, so the times are stored as sortable 64-bit numbers
  (`DateTimeOffsetToBinaryConverter`).
- **An index on (OwnerId, UpdatedAt)** matches the one query every list makes.
- **Cascade delete:** deleting a user deletes their calculations (a foreign key to Identity's users table).
- **`ExecuteDeleteAsync`** deletes in one SQL statement, without loading the row first.

## API (`src/MortgageAnalytics.Api`)

| File | Purpose |
|---|---|
| `Program.cs` | Composition root and middleware pipeline |
| `Endpoints/*.cs` | One static class per area, each with a `Map…Endpoints` extension: amortization, refinance, strategies, saved calculations, account |
| `Filters/ValidationFilter.cs` | Generic endpoint filter: finds the `TRequest` argument, validates it, returns a 400 ValidationProblem or calls the endpoint |
| `Errors/GlobalExceptionHandler.cs` | `IExceptionHandler`: unreadable requests keep their status (400, 413); anything else is a logged, generic 500 |
| `Security/SecurityHeaders.cs` | The Content-Security-Policy and the other browser security headers, on every response |
| `Email/` | `AccountEmailSender` (the email text and links), `SmtpMailTransport` (MailKit), `FileOutbox` (local dev), `EmailSetup` (wiring, and the Development-only outbox endpoints) |

### The pipeline (in `Program.cs` order)

1. `UseSecurityHeaders()`: first, so even errors and static files carry the CSP and the other headers.
2. `UseResponseCompression()`: Brotli or gzip for the JSON and the app's own files.
3. `UseExceptionHandler()` + `UseStatusCodePages()`: every error becomes ProblemDetails.
4. Swagger and Swagger UI (in every environment: the docs are part of the showcase).
5. `UseDefaultFiles()` + `UseStaticFiles()`: the Angular app from `wwwroot`.
6. `UseAuthentication()` + `UseAuthorization()`, then `UseRateLimiter()` (the account attempt limit).
7. Endpoints: `/health`, the API groups, the dev outbox (Development only).
8. A JSON 404 for unknown `/api/...` routes, then `MapFallbackToFile("index.html")` so Angular's router handles
   every other URL.

### An endpoint, annotated

```csharp
group.MapPost("/calculate", Calculate)                                // POST /api/v1/amortization/calculate
    .WithName("CalculateAmortization")                                // operationId in OpenAPI
    .WithSummary("...")                                               // shown in Swagger
    .AddEndpointFilter<ValidationFilter<AmortizationRequest>>()       // validate first
    .ProducesValidationProblem()                                      // document the 400
    .ProducesProblem(StatusCodes.Status500InternalServerError);       // and the 500

private static Ok<AmortizationResponse> Calculate(
    AmortizationRequest request,          // bound from the JSON body
    IAmortizationService service,         // injected from DI
    bool includePayments = true)          // bound from the query string
    => TypedResults.Ok(...);              // TypedResults: OpenAPI knows the 200 shape
```

The endpoint does HTTP only. Validation is in the filter, and the work is in the service.
