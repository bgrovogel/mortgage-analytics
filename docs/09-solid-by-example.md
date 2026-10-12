# 9. SOLID by example: the amortization engine

> **One section of the code, all five SOLID principles, with the real code for each.** Read this to explain SOLID
> with something concrete instead of definitions: every snippet below is copied from the repository.
>
> **The section:** the engine that builds a loan's schedule, and the pieces it is built from: extra-payment rules,
> housing costs, the calculator, the comparer, and the service that wires them up.

**Read time:** 15 min · **Best for:** "Where do you apply SOLID?" · **Code:** `Domain/ExtraPayments/`, `Domain/HousingCosts/`, `Domain/Amortization/`,
`Application/Services/AmortizationService.cs`

**On this page:** [The section in one picture](#the-section-in-one-picture) · [S](#s-single-responsibility) ·
[O](#o-openclosed) · [L](#l-liskov-substitution) · [I](#i-interface-segregation) · [D](#d-dependency-inversion) ·
[Where it bends](#where-it-bends) · [Saying it in two minutes](#saying-it-in-two-minutes)

---

## The section in one picture

```text
AmortizationService            maps a request to domain objects, and the result back to a response
  │  depends on ILoanComparer and TimeProvider
  ▼
LoanComparer                   runs the loan with and without extras, and pairs up the costs
  │  depends on IAmortizationCalculator         │  applies
  ▼                                             ▼
AmortizationCalculator                        HousingCostPlan
  │  asks "how much extra this month?"          │  sums any number of
  ▼                                             ▼
ExtraPaymentPlan                              «IHousingCost»
  │  sums any number of                         ├── ValueBasedTax       property, school, local and MUD taxes
  ▼                                             ├── AnnualFixedCost     homeowners insurance, PID assessment
«IExtraPaymentRule»                             ├── MonthlyFixedCost    HOA dues
  ├── MonthlyExtraPayment                       └── MortgageInsurance   PMI
  ├── AnnualExtraPayment
  └── LumpSumExtraPayment
```

Read it top to bottom: the **service** asks a **comparer** to run a loan twice (with and without extra payments). The
comparer asks a **calculator** for each schedule. The calculator asks a **plan** for each month's extra payment, and
the plan asks each of its **rules**. Housing costs work the same way, through their own plan.

| Principle | In one sentence, here |
|---|---|
| **S**ingle responsibility | The calculator builds schedules, the comparer compares, the service maps: each has one reason to change. |
| **O**pen/closed | A new kind of extra payment or housing cost is a new class; the calculator does not change. |
| **L**iskov substitution | Any rule or cost works wherever the interface is expected, and the plans sum whatever they hold. |
| **I**nterface segregation | A rule has one method; a cost has two members and is given only what it needs. |
| **D**ependency inversion | The service depends on `ILoanComparer` and `TimeProvider`, so tests swap both. |

---

## S: Single responsibility

> *A class should have one reason to change.*

Each class in the section does one job, and the job is in its name:

| Class | Its one job | What would make it change |
|---|---|---|
| `PaymentFormula` | The monthly payment for an amount, rate and term | The annuity formula (never, in practice) |
| `AmortizationCalculator` | Build one schedule, month by month | How lenders apply payments, recasts or rate resets |
| `ExtraPaymentPlan` | Combine the extra-payment rules into one amount per month | How several prepayments combine |
| `HousingCostPlan` | Apply every housing cost to a schedule | How costs are charged alongside a schedule |
| `LoanComparer` | Run the loan with and without extras, and pair up the costs | What "a comparison" contains |
| `AmortizationService` | Turn a request into domain objects, run them, turn the result into a response | The API's request or response shape |

The calculator shows what that looks like. It knows nothing about requests, JSON, taxes or how many kinds of extra
payment exist; it asks the plan for a number:

```csharp
// src/MortgageAnalytics.Domain/Amortization/AmortizationCalculator.cs
var interest = LoanTerms.MonthlyInterestOn(balance, rate);
var isFinalPeriod = period == loan.TermInMonths;
var principal = isFinalPeriod ? balance : Math.Min(payment - interest, balance);
balance -= principal;

var extra = Math.Min(extraPayments.AmountFor(period), balance);   // "how much extra this month?"
balance -= extra;
```

And the service does mapping and nothing else. Every line is "turn this into that" or "ask someone":

```csharp
// src/MortgageAnalytics.Application/Services/AmortizationService.cs
var purchase = request.ToPurchase();
var loan = request.ToLoanTerms(purchase, clock.FirstOfNextMonth());
var valuation = request.HousingCosts.ToValuation(purchase);
var plan = request.HousingCosts.ToHousingCostPlan(purchase, valuation);
var comparison = comparer.Compare(loan, request.ExtraPayments.ToExtraPaymentPlan(), request.ToRecastPolicy(), plan);
```

> **Why it matters here:** when separate property taxes, exemptions and the over-65 tax ceiling arrived, the only
> domain files that changed were in `HousingCosts/`. The calculator, the comparer and their tests were untouched.
> Small classes with one job meant small, safe changes.

---

## O: Open/closed

> *Open for extension, closed for modification: add behaviour by adding code, not by editing what works.*

The calculator never asks *what kind* of extra payment it is dealing with. Every kind implements one interface:

```csharp
// src/MortgageAnalytics.Domain/ExtraPayments/IExtraPaymentRule.cs
public interface IExtraPaymentRule
{
    decimal AmountFor(int paymentNumber);
}
```

Each kind of prepayment is one small class:

```csharp
// MonthlyExtraPayment.cs: the same amount every month from a starting payment
public decimal AmountFor(int paymentNumber) => paymentNumber >= StartingPaymentNumber ? Amount : 0m;

// LumpSumExtraPayment.cs: one amount, with one payment
public decimal AmountFor(int paymentNumber) => paymentNumber == PaymentNumber ? Amount : 0m;
```

**Adding a new kind is a new class and nothing else.** Suppose the business wanted "round every payment up to the next
$100". That is one class:

```csharp
// Hypothetical: not in the code base, to show the shape of an extension.
public sealed class RoundUpExtraPayment(decimal scheduledPayment) : IExtraPaymentRule
{
    public decimal AmountFor(int paymentNumber) => Math.Ceiling(scheduledPayment / 100m) * 100m - scheduledPayment;
}
```

`AmortizationCalculator`, `ExtraPaymentPlan`, `LoanComparer` and their tests are untouched. Housing costs work
exactly the same way: flood insurance would be a new `IHousingCost`.

> **Note:** This is how the code actually grew. Separate school, county/city and MUD taxes, homestead exemptions and the
> over-65 ceiling went into `ValueBasedTax` and its helpers (`TaxExemption`, `SeniorTaxRelief`), behind the same
> `IHousingCost` interface, with no change to the amortization engine.

---

## L: Liskov substitution

> *Anything that implements an interface must work wherever that interface is expected, without surprises.*

`ExtraPaymentPlan` holds a list of `IExtraPaymentRule` and treats every rule the same way:

```csharp
// src/MortgageAnalytics.Domain/ExtraPayments/ExtraPaymentPlan.cs
public decimal AmountFor(int paymentNumber) => Money.Round(_rules.Sum(rule => rule.AmountFor(paymentNumber)));

public decimal LargestSinglePaymentFor(int paymentNumber) =>
    _rules.Count == 0 ? 0m : Money.Round(_rules.Max(rule => rule.AmountFor(paymentNumber)));
```

That only works because every rule keeps the same promises:

| The promise | How it is kept |
|---|---|
| **Never negative.** An amount below zero would quietly *add* to the balance. | Every rule's constructor calls `ExtraPaymentGuard.AgainstInvalid`, which rejects a negative amount. |
| **Zero when it does not apply,** never an exception. | `Monthly` returns 0 before it starts; `LumpSum` returns 0 on every other payment. |
| **One rule is one payment.** The recast rule compares the *largest single* prepayment with the lender's minimum. | Each rule describes one stream of payments, so `Max` across rules really is the largest single one. |

Housing costs make the same promises, through `AmountFor(CostPeriod)`: an amount in cents, never negative (each
cost's guard), whatever the period. So `HousingCostPlan` sums a property tax, PMI and HOA dues without knowing which
is which.

> **How the tests prove it:** `GuardLimitTests` checks each guard at its limit and just past it (a $0 extra payment
> is accepted, -$0.01 is rejected), and the calculator's invariant tests check that every loan shape, from a
> one-dollar loan to the maximum, repays its principal to the cent.

---

## I: Interface segregation

> *No class should be forced to depend on methods it does not use.*

The interfaces here are as small as the job:

```csharp
public interface IExtraPaymentRule      // one method
{
    decimal AmountFor(int paymentNumber);
}

public interface IHousingCost           // two members
{
    HousingCostCategory Category { get; }
    decimal AmountFor(CostPeriod period);
}
```

And a housing cost is handed only what a cost could need to know about a month, not the whole loan or schedule:

```csharp
// src/MortgageAnalytics.Domain/HousingCosts/IHousingCost.cs
public readonly record struct CostPeriod(int PaymentNumber, decimal OpeningBalance, decimal ScheduledOpeningBalance);
```

HOA dues use only the payment number. PMI uses the balances (the *scheduled* one for automatic removal at 78%, the
*actual* one for removal on request at 80%). Neither has to know how a schedule is built.

**The alternative it avoids:** one `ILoanCalculator` with `Generate`, `Compare`, `ApplyCosts`, `MonthlyPayment` and
`Projection`. Every implementation would carry all five, and every test double would have to fake all five.

---

## D: Dependency inversion

> *High-level code depends on abstractions; the details depend on those abstractions too.*

The service, the high-level policy, never creates the classes it uses. It asks for abstractions in its constructor:

```csharp
// src/MortgageAnalytics.Application/Services/AmortizationService.cs
public sealed class AmortizationService(ILoanComparer comparer, TimeProvider clock) : IAmortizationService
```

- **`ILoanComparer`**, not `LoanComparer`, which in turn asks for `IAmortizationCalculator`, not the class.
- **`TimeProvider`**, not `DateTime.Now`: "today" decides the default first payment, so time is a dependency too.

The composition root decides what the abstractions are, in one place:

```csharp
// src/MortgageAnalytics.Application/DependencyInjection.cs
services.AddSingleton<IAmortizationCalculator, AmortizationCalculator>();
services.AddSingleton<ILoanComparer, LoanComparer>();
services.AddSingleton<IAmortizationService, AmortizationService>();
// ... the refinance and strategy services ...
services.TryAddSingleton(TimeProvider.System);
```

**The payoff is in the tests.** The service's unit tests replace the comparer with an NSubstitute double and the clock
with a fixed one, so each test checks one mapping decision without running the engine:

```csharp
// tests/MortgageAnalytics.Application.Tests/Services/AmortizationServiceTestBase.cs
Comparer = Substitute.For<ILoanComparer>();
Comparer.Compare(default!, default!, default!, default!).ReturnsForAnyArgs(CannedComparison);
Clock = TestClock.Create();
Service = new AmortizationService(Comparer, Clock);
```

```csharp
// tests/MortgageAnalytics.Application.Tests/Services/AmortizationServiceTests.cs
[Test]
public void Analyze_ShortenTerm_NeverRecasts_EvenWhenRecastTermsAreSent()
{
    Service.Analyze(A.Request.WithStrategy(ExtraPaymentStrategy.ShortenTerm).WithRecastTerms(1_000m, 0m));

    Assert.That(CompareArguments().Recast, Is.EqualTo(RecastPolicy.Never), "recast terms only matter when the Recast strategy is chosen");
}
```

> **Note:** The same idea runs through the layers: Application owns `ISavedCalculationRepository`, and Infrastructure implements
> it with EF Core. The use cases never know a database exists. See [Architecture](03-architecture.md).

---

## Where it bends

Good answers to "where does your code break SOLID?" name a real place and the reason. In this section:

| Where | The bend | Why it is acceptable |
|---|---|---|
| `HousingCostPlan.Taxes` returns `_costs.OfType<ValueBasedTax>()` | The plan reaches for a concrete type, so the projection can show what each tax is charged on. | Only the *projection* needs it, not the monthly costs; a separate `ITaxedValue` interface would add a type for one caller. If a second kind of taxed cost appeared, that interface would be worth it. |
| `AmortizationCalculator.Generate` is one loop with five steps | One method does rate resets, interest, principal, extras and recasts. | The steps must happen in a fixed order each month, and the order *is* the logic. One loop, with the order written in its doc comment, is easier to check against the independent Python model than five classes passing state around. |
| `ExtraPaymentPlan.LargestSinglePaymentFor` | The plan knows about a lender rule (recasts look at one payment, not the total). | It is the only place that can know which amounts are separate payments. Putting it in the calculator would make the calculator count rules. |

More of these, across the whole code base: [Interview guide](08-interview-guide.md#design-and-architecture).

---

## Saying it in two minutes

> "Take the amortization engine. **Single responsibility:** the calculator only builds a schedule; the comparer runs it
> twice and pairs up the costs; the service only maps a request to domain objects and back.
>
> **Open/closed:** the calculator asks an `ExtraPaymentPlan` for this month's extra. Monthly, yearly and lump-sum
> payments are each a small class behind `IExtraPaymentRule`, so a new kind of prepayment is a new class and the
> calculator never changes. Taxes, PMI and dues work the same way behind `IHousingCost`; that is how I added separate
> property taxes and the over-65 ceiling without touching the engine.
>
> **Liskov:** the plan just sums its rules, which works because every rule promises to be non-negative and zero when
> it does not apply, and the guards enforce it.
>
> **Interface segregation:** a rule is one method; a cost gets a small `CostPeriod`, not the whole loan.
>
> **Dependency inversion:** the service depends on `ILoanComparer` and `TimeProvider`. In production that is the real
> comparer and the system clock; in tests it is an NSubstitute double and a fixed date, so each test checks one mapping
> decision. And where it bends: the calculator is one loop on purpose, because the order of the steps is the logic."

---

← Previous: [8. Interview guide](08-interview-guide.md) · [Guide contents](README.md)
