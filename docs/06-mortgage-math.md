# 6. The mortgage math

The domain, in plain terms, with the worked numbers the tests pin. Every number here was computed by an
independent Python `Decimal` model and is asserted to the cent in the test suite. The **reference loan** used
throughout is **$200,000 at 6% over 30 years** (a $250,000 home with $50,000 down).

**On this page:** [Amortization](#amortization) · [Extra payments](#extra-payments) · [Recasting](#recasting) · [Net savings](#net-savings) · [PMI (private mortgage insurance)](#pmi-private-mortgage-insurance) · [Property taxes](#property-taxes) · [Adjustable-rate mortgages (ARMs)](#adjustable-rate-mortgages-arms) · [Temporary buydowns](#temporary-buydowns) · [Refinancing](#refinancing) · [Pay off early or invest?](#pay-off-early-or-invest) · [Modelling decisions](#modelling-decisions) · [Why independent models](#why-independent-models)

## Amortization

A fixed-rate mortgage has one level monthly payment that pays off the loan exactly over its term:

```
M = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)        P = principal, r = annual rate ÷ 12, n = number of payments
```

`PaymentFormula.MonthlyPayment` computes it in `decimal`. For the reference loan, **M = $1,199.10**.

Each month:
- **Interest** = balance × annual rate ÷ 1,200, rounded to cents. Month 1: $200,000 × 6 ÷ 1,200 = **$1,000.00**.
- **Principal** = payment − interest. Month 1: $1,199.10 − $1,000.00 = **$199.10**.
- Early payments are mostly interest, and late ones mostly principal. That's why restarting a loan (refinancing)
  matters so much.
- Rounding to cents leaves a few cents of drift, so the **final payment** takes the exact remaining balance:
  **$1,200.14**. Total interest: **$231,677.04**.

## Extra payments

Money paid on top of the payment goes straight to principal, so every later month charges less interest.

- **$200 a month extra** on the reference loan: paid off in **252 payments instead of 360** (108 sooner), with
  **$79,800.86** less interest.
- Kinds: monthly, annual (from a given payment number), and one-time lump sums, in any combination.
- An extra payment bigger than the balance is capped, so the loan is never overpaid.
- On a loan already being paid, extra payments can only start with the next payment.

## Recasting

Extra payments normally **shorten** the loan; the payment stays the same. A **recast** keeps the payoff date
and **lowers the payment** instead: the lender re-amortizes the smaller balance over the months left.

- Lenders recast only after **one lump sum of at least their minimum** (often $10,000), for a fee (often $250).
  The engine compares the month's *largest single* prepayment with the minimum, not the month's total: $200 a
  month plus a $9,900 lump sum does not recast. The tests pin the boundary: $9,999.99 doesn't, $10,000 does.
- Reference: a **$50,000 lump sum with payment 12**, then a recast: the payment drops to **$895.60**, and total
  interest is $176,056.85.

## Net savings

**Net savings = interest saved + PMI saved − recast fees.** Taxes, insurance and HOA dues are left out on
purpose: they don't stop when the loan is paid off, so counting the months of escrow you "skip" would overstate
the benefit. A test locks this in.

## PMI (private mortgage insurance)

- Required when the down payment is **under 20%**. `PropertyPurchase` holds this rule, once.
- Priced as a yearly percentage of the **original** loan (e.g. 0.5%), paid monthly.
- Removal follows the Homeowners Protection Act, two ways:
  - **Automatic at 78%** of the original value, measured on the **original schedule**, so extra payments don't
    move it.
  - **On request at 80%**, which may use the **actual** balance, so extra payments bring it forward, and that
    saving counts in net savings.
- Each month therefore carries two balances: the actual one and the original schedule's.

## Property taxes

Two ways to enter them:

1. **One combined rate** (the default, how most tax bills read): e.g. 2.2% of the taxable value, with one
   **homestead exemption in dollars** taken off the value first. A $50,000 exemption at 2.2% saves
   **$1,100 a year**.
2. **Separate taxes** (as in Texas): school, county/city and MUD, each with its own rate and its own exemption.
   - **School:** a fixed amount off ($140,000 for a Texas homestead since 2025).
   - **County/city** and **MUD:** a percentage off (up to 20% in Texas, at least $5,000).
   - Each exemption lowers **only its own tax**. Applying the $140,000 school exemption to the whole bill would
     understate taxes by thousands a year.
   - **Over 65 or disabled:** an extra school exemption ($60,000 in Texas) and a **school tax ceiling**: from
     the qualifying year, school tax can fall but never rise. It is set in the year the owner qualifies, not at
     purchase.

And for both ways:
- **Texas rates are quoted per $100 of value**, so "$0.85 per $100" is entered as 0.85%.
- **Appraisal cap:** a homestead's *taxable* value can rise at most 10% a year in Texas, even when the market
  rises faster. `PropertyValuation` tracks market value and taxable value separately; the gap shows on the Home
  value chart.
- **Home values grow** by a yearly rate (default 4.3%, the FHFA long-run average), which drives each year's bill.
  Insurance (+4.8%) and HOA dues (+4%) grow by their own rates.
- **Installments add up exactly:** a $5,000 yearly bill is 11 × $416.67 + $416.63, never $5,000.04.

## Adjustable-rate mortgages (ARMs)

An ARM's rate is fixed for a first period, then **resets** at a regular interval. A **7/1** is fixed for 7
years (84 payments), then resets every year; a **7/6** resets every 6 months.

- At each reset the payment is **re-amortized**: the balance left, over the payments left, at the new rate.
- Nobody knows future rates, so the user gives an **expected rate**, and each reset moves toward it **as far as
  the caps allow**. Caps are quoted like "5/2/5": the most the **first** reset can move, the most **each later**
  one can, and the most the rate can **ever** differ from the start (the lifetime cap).
- The **margin** (often 2.75%) is the rate's **floor**: ARM notes don't let the rate fall below it. With a
  margin, the lifetime cap only limits the rise.
- The results also show the **worst case**: rates rising as far and as fast as the caps allow.

Worked examples on the reference loan as a 7/1:

| Scenario | What happens |
|---|---|
| Expected 7.5%, caps 5/2/5 | Payment 85 resets to 7.5%: **$1,199.10 → $1,365.01**. Total interest $277,467.08. |
| Worst case, caps 5/2/5 | The first reset can jump 5 points, straight to 11%: peak payment **$1,787.42**. |
| Expected 2%, caps 2/2/5, **no margin** | 4% at payment 85 ($994.55), then 2% at payment 97 ($817.23). |
| Expected 2%, caps 2/2/5, **2.75% margin** | 4% at payment 85, then it **stops at 2.75%** ($881.34). Total interest $145,332.19. |

In code: `AdjustableRate.RatePath()` produces the list of rate changes, and the ordinary amortization loop
re-amortizes whenever `loan.AnnualRateFor(period)` changes.

## Temporary buydowns

A **2-1 buydown**: the borrower pays as if the rate were 2 points lower in year 1 and 1 point lower in year 2. A
**subsidy** (usually paid up front by the seller or builder) covers the difference. The loan itself stays at the
note rate, so its interest and payoff don't change.

Each year's payment is the standard payment on the original amount, over the full term, at the reduced rate.
For the reference loan with a 2-1:

| Year | Paid as if at | Payment |
|---|---|---|
| 1 | 4% | $954.83 |
| 2 | 5% | $1,073.64 |
| 3 on | 6% | $1,199.10 |

The subsidy is the sum of the differences: **$4,436.76**. Options: 1-0, 2-1, 3-2-1, 1-1.

**Who pays for it decides what it saves.** The loan charges its note-rate interest either way ($231,677.04 on the
reference loan), and the principal paid each month does not change, so the subsidy pays interest:

- **The seller or builder pays** (a concession, the usual case): you pay **$231,677.04 − $4,436.76 = $227,240.28** of
  the interest. Each buydown saves a different amount: a 3-2-1 more than a 2-1, a 1-0 less.
- **You pay, at closing:** the subsidy is your own money, paid up front and returned as lower payments over the
  buydown years. It changes **when** you pay, not how much: you pay all $231,677.04.

`TemporaryBuydown.InterestYouPay` applies this to each schedule (with extra payments too: a loan paid off during the
buydown years needs less subsidy), and every schedule in the response carries `buydownSubsidy` and `interestYouPay`.
The headline and the rate plan say which case applies. (A **permanent** buydown, discount points, is different: it
lowers the note rate for the whole loan, so enter the lower rate.)

## Refinancing

Compare the rest of the current loan with a new one. Reference: **$300,000 left at 7%, 25 years to go**
($2,120.34 a month), refinanced to **6% for a new 30 years** with $6,000 closing costs.

| | |
|---|---|
| New payment | **$1,798.65**, $321.69 a month lower |
| Lifetime savings | **−$17,415.28**: the refinance costs *more* overall |
| Why | The clock restarts: **60 more payments**, mostly interest again |
| Break-even | Payment **25**, when the interest saved first covers the closing costs |
| Keep paying $2,120.34 on the new loan | Paid off in **247 payments**, and **$107,590.12** saved |

Key ideas:
- **Lifetime savings** = everything still owed on the current loan − (everything paid on the new one + closing
  costs paid up front).
- **Break-even counts interest, not payments**: principal repaid isn't a cost. The common "closing costs ÷
  monthly savings" overstates the benefit when costs are financed or the term is longer.
- The loan today can be entered as **what's owed now**, or as **the original loan** (amount, term, first
  payment), from which the server works out the balance on that loan's own schedule.
- A buydown on the new loan is paid at closing, so it changes **when** you pay, not how much.

## Pay off early or invest?

For a household with spare cash each month, three **strategies** played out month by month for up to 30 years:

1. **Debt free ASAP:** every extra dollar to principal; once the loan is gone, everything is invested.
2. **Invest the difference:** pay the required payment, invest the rest.
3. **Hybrid:** split the extra cash by how the after-tax rates compare.

**Free money first.** Every strategy first takes the full 401(k) employer match (at its after-tax cost) and any
ESPP discount, because no mortgage rate beats an instant 50–100% return. Only the cash left over is directed
differently, so all three spend the same each month.

**Three market scenarios.** Each strategy runs at:
- the **expected** return (e.g. 10%, the S&P 500's long-run average with dividends);
- a **risk-adjusted** return: the expected return minus 4, 2 or 0 points for a Conservative, Balanced or Aggressive
  profile. **The recommendation is ranked on this**, because paying down a mortgage earns its rate for certain and
  the market doesn't;
- a **lost decade first**: −1% a year for 10 years (like 2000–2009), then the risk-adjusted return. The page always
  says whether a bad decade would reverse the recommendation.

**Taxes, realistically:**
- Mortgage interest only saves tax on itemized deductions **above the standard deduction**, year by year. Paying
  down early shrinks the deduction too. The $750,000 debt limit applies.
- Net worth counts every account **after the tax still owed**: a 401(k) at the income tax rate, capital gains on
  taxable growth, a Roth tax-free.

**The hybrid's split** compares what a dollar earns on the mortgage, after tax (the rate, less any tax it saves),
with what it earns invested, after tax. Stock that arrives anyway (RSUs kept as shares, ESOP) counts toward the
market share, so someone already heavy in company stock leans toward the mortgage. An **ARM** uses its average
rate over the payments left; a **buydown's** subsidy frees cash in every strategy.

## Modelling decisions

The choices behind the numbers, each pinned by a test:

**Getting the money right**
- **`decimal` everywhere, never `double`.** `Math.Pow` works in `double`, so the annuity formula raises to a power by
  squaring in `decimal` instead (`DecimalMath.Pow`).
- **One rounding rule, in one place.** `Money.Round` rounds to cents, half away from zero.
- **Every schedule ends at exactly $0.00.** The final payment absorbs the rounding drift, asserted across a range of
  loan shapes.
- **Yearly bills add up exactly.** A $5,000 tax bill is eleven installments of $416.67 and a twelfth of $416.63, never
  $5,000.04: the same rule as the final payment, in one shared `Installments` helper.

**Following the real rules**
- **The down payment is an input; the loan is derived.** A loan amount and a home value typed separately could
  disagree. `PropertyPurchase` derives the loan, the LTV and whether PMI applies, so the 20% rule is written once.
- **Recasts follow lender rules.** The calculator compares the period's *largest single* prepayment with the minimum,
  not the month's total, so $200 a month plus a $9,900 lump sum does not recast. The tests pin the boundary: $9,999.99
  does not, $10,000 does. A zero minimum is rejected, or every routine extra payment would trigger a recast and its fee.
- **PMI removal follows the law.** Automatic removal at 78% is measured on the original schedule, so extra payments do
  not move it; a request at 80% may use the actual balance, so they do, and only that saving counts. Each cost period
  therefore carries both balances: the actual one and the original schedule's.
- **Homestead rules are per taxing unit.** The Texas $140,000 exemption applies only to school tax, so school tax is
  its own unit with its own `TaxExemption`. Applying it to the whole bill would understate taxes by thousands a year.
- **The over-65 ceiling is set in the qualifying year,** not at purchase: a 60-year-old buyer sees normal growth for
  five years, then a freeze. The bill is the lower of this year's tax and the qualifying year's, so it can still fall.
- **Market value and taxable value are tracked separately.** When the market outruns the cap, the owner is taxed on
  the lower figure, and the home value chart shows the gap.

**Comparing honestly**
- **Projections follow the full term,** on the standard schedule, because taxes, insurance and dues continue whether
  or not the loan is paid off early.
- **Savings leave out costs that do not go away.** A shorter loan collects taxes and insurance through escrow for
  fewer months, but the owner keeps paying them. `LoanComparison.NetSavings` counts only interest and PMI, less recast
  fees, and a test locks that in.

## Why independent models

The expected numbers in the tests don't come from this code. They come from Python `Decimal` models written from
the rules:
- `tools/rate-check/rate_model.py` for ARMs and buydowns;
- `tools/calculator-check/calculator_model.py` for the purchase calculator (schedule, PMI, taxes, costs, projection,
  savings) and the refinance comparison, plus `compare_with_api.py`, which checks 300 random purchases and 300 random
  refinances against the live API, every field;
- `tools/strategy-check/strategy_model.py` for pay off or invest, plus `compare_with_api.py`, which checks 300 random
  households against the live API, field by field.

This has caught real bugs: a half-cent interest rounding difference (7% ÷ 12 repeats forever, so interest is now
balance × rate ÷ 1,200), and a 100% employer match the validator wrongly rejected.

---

← Previous: [5. Frontend](05-frontend.md) · [Guide contents](README.md) · Next: [7. Testing and quality](07-testing.md) →
