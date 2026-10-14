# 6. The mortgage math

> **The domain in plain terms, with the worked numbers the tests pin.** Every number here was computed by an
> independent Python `Decimal` model and is asserted to the cent in the test suite.
>
> The **reference loan** used throughout is **$200,000 at 6% over 30 years** (a $250,000 home with $50,000 down).

**Read time:** 14 min · **Best for:** checking the numbers · **Code:** `src/MortgageAnalytics.Domain/`, `tools/`

**On this page:** [Amortization](#amortization) · [Extra payments](#extra-payments) · [Recasting](#recasting) ·
[Net savings](#net-savings) · [Equity](#equity) · [PMI (private mortgage insurance)](#pmi-private-mortgage-insurance) ·
[FHA and VA loans](#fha-and-va-loans) ·
[Property taxes](#property-taxes) · [Adjustable-rate mortgages (ARMs)](#adjustable-rate-mortgages-arms) ·
[Temporary buydowns](#temporary-buydowns) · [Discount points](#discount-points) · [Cash to close](#cash-to-close) · [Refinancing](#refinancing) ·
[Pay off early or invest?](#pay-off-early-or-invest) · [Modelling decisions](#modelling-decisions) ·
[Why independent models](#why-independent-models)

---

## Amortization

A fixed-rate mortgage has one level monthly payment that pays off the loan exactly over its term:

```text
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

![Where each payment goes: $1,000 of the first $1,199.10 is interest; principal overtakes interest from payment 223, in year 19](images/chart-payment-split.svg)

---

## Extra payments

Money paid on top of the payment goes straight to principal, so every later month charges less interest.

- **$200 a month extra** on the reference loan: paid off in **252 payments instead of 360** (108 sooner), with
  **$79,800.86** less interest.
- Kinds: monthly, annual (from a given payment number), and one-time lump sums, in any combination.
- An extra payment bigger than the balance is capped, so the loan is never overpaid.
- On a loan already being paid, extra payments can only start with the next payment.

![$200 a month extra: the balance reaches zero at payment 252 instead of 360, and the gap between the two curves is $79,800.86 of interest never charged](images/chart-extra-payments.svg)

---

## Recasting

Extra payments normally **shorten** the loan; the payment stays the same. A **recast** keeps the payoff date
and **lowers the payment** instead: the lender re-amortizes the smaller balance over the months left.

- Lenders recast only after **one lump sum of at least their minimum** (often $10,000), for a fee (often $250).
  The engine compares the month's *largest single* prepayment with the minimum, not the month's total: $200 a
  month plus a $9,900 lump sum does not recast. The tests pin the boundary: $9,999.99 doesn't, $10,000 does.
- Reference: a **$50,000 lump sum with payment 12**, then a recast: the payment drops to **$895.60**, and total
  interest is $176,056.85.

---

## Net savings

**Net savings = interest saved + PMI saved − recast fees.** Taxes, insurance and HOA dues are left out on
purpose: they don't stop when the loan is paid off, so counting the months of escrow you "skip" would overstate
the benefit. A test locks this in.

---

## Equity

**Equity = the home's market value − what is owed**, at the start of each loan year. What is owed follows your plan,
extra payments included, because that is what you will actually owe: the whole loan in year 1 (so the equity is the
down payment), the balance after each year's last payment after that, and nothing once the loan is paid off. On the
reference loan with 3% growth, year 2 starts owing $197,543.99 of a home worth $257,500: $59,956.01 of equity.

---

## PMI (private mortgage insurance)

- Required when the down payment is **under 20%**. `PropertyPurchase` holds this rule, once.
- Priced as a yearly percentage of the **original** loan (e.g. 0.5%), paid monthly.
- Removal follows the Homeowners Protection Act, two ways:
  - **Automatic at 78%** of the original value, measured on the **original schedule**, so extra payments don't
    move it.
  - **On request at 80%**, which may use the **actual** balance, so extra payments bring it forward, and that
    saving counts in net savings. This is the default: a borrower paying extra asks as soon as they can. The PMI tile
    says what the other way would do: when not asking would end it and what that costs, or, with automatic removal
    chosen, what asking would save.
  - Either way, **at the loan's midpoint** (payment 180 of 360) whatever the balance: the Act's final termination.
    It matters at high rates, where the balance falls slowly: 3% down at 12% would otherwise pay PMI 28 months longer.
- Each month therefore carries two balances: the actual one and the original schedule's.
- **On the other pages** (`LoanPmi`), only a loan and the home's value are known. PMI already on a loan is the premium
  on the statement, until the balance is 80% of the home's value today, when the borrower can ask for it to go. A new
  loan (a refinance) needs PMI only above 80% of the value, at a yearly rate on the loan, until 80% or its midpoint.

---

## FHA and VA loans

Neither has PMI. Each has an **upfront fee** on the base loan (the price less the down payment), usually added to
the loan, so everything after (the payment, interest, prepaid interest, points, equity) is on the larger amount.

**FHA** ([HUD Mortgagee Letter 2023-05](https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf), case
numbers endorsed from 20 March 2023): at least 3.5% down, a **1.75%** upfront MIP, and an annual MIP from this table,
by the base loan's LTV and whether it is above the national conforming loan limit
([FHFA](https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-values-for-2026): $726,200 in
2023, $766,550 in 2024, $806,500 in 2025, $832,750 in 2026; the year the loan closes, taken as the month before the
first payment):

| Term | Base loan | LTV | Annual MIP | For |
|---|---|---|---|---|
| Over 15 years | Up to the limit | ≤ 90% | 0.50% | 11 years |
| | | > 90%, ≤ 95% | 0.50% | the whole loan |
| | | > 95% | 0.55% | the whole loan |
| | Above the limit | ≤ 90% / ≤ 95% / > 95% | 0.70% / 0.70% / 0.75% | 11 years / whole / whole |
| 15 years or less | Up to the limit | ≤ 90% / > 90% | 0.15% / 0.40% | 11 years / whole |
| | Above the limit | ≤ 78% / ≤ 90% / > 90% | 0.15% / 0.40% / 0.65% | 11 / 11 years / whole |

Each loan year's monthly MIP is `round(round(average balance × rate) ÷ 12)`, the average being that year's 12
opening balances on the **original** schedule at the starting rate, so extra payments don't lower it; paying the loan
off ends it. $300,000 with 3.5% down at 6.5%: $289,500 base loan, $5,066.25 upfront MIP, $294,566.25 borrowed; 0.55%
for 360 payments; $134.33 a month in year 1, $132.77 in year 2, $31,790.40 over the loan.

**VA** ([VA.gov, from 7 April 2023](https://www.va.gov/housing-assistance/home-loans/funding-fee-and-closing-costs/)):
no down payment needed and no mortgage insurance. The funding fee for a purchase:

| Down payment | First use | Used before |
|---|---|---|
| Less than 5% | 2.15% | 3.3% |
| 5% or more | 1.5% | 1.5% |
| 10% or more | 1.25% | 1.25% |

Veterans receiving compensation for a service-connected disability (and some others) pay none. $400,000 with nothing
down, first use: $8,600, so $408,600 is borrowed.

**FHA's other limits:**
- **Credit score** (the decision score; [HUD ML 2010-29](https://www.hud.gov/sites/documents/10-29ml.pdf)): 580 or
  more needs the 3.5% minimum down; 500 to 579, 10% (a 90% LTV at most); below 500, FHA does not insure the loan.
  Left blank, the score counts as 580 or more.
- **The county's loan limit** ([HUD ML 2025-23](https://www.hud.gov/sites/dfiles/hudclips/documents/2025-23hsgml.pdf),
  one-unit homes, case numbers from 1 January 2026): the base loan must be within it. The app ships HUD's whole table,
  3,235 counties from the $541,287 floor to the $1,249,125 ceiling (higher in Alaska, Hawaii and the territories),
  built from HUD's own file by `tools/fha-limits`; Bexar County, Texas, is $557,750.

What is **not** modelled: loans endorsed before 20 March 2023 (which paid more MIP), FHA limits for two to four units,
and the VA's limits on what the buyer may pay.

---

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
     the qualifying year, school tax can fall but never rise. It is set in the year the owner qualifies (at that
     year's rate), not at purchase.
   - **A ceiling brought from a former home** ([Texas Tax Code §11.26(g)](https://texas.public.law/statutes/tex._tax_code_section_11.26)):
     the new home's ceiling is its first year's school tax times the share paid at the old one (the tax under the
     old ceiling over the tax without it). Paying 40% there, a new home owing $500 is capped at $200. A county or
     city ceiling moves only within the same county or city, which is not modelled; nor is the yearly lowering of
     school ceilings when the state compresses school rates (§11.26(a-10)).

And for both ways:
- **Rates can change** from a given loan year until the next change (each tax on its own): $250,000 at 2% is
  $5,000 a year, and $3,750 from the year it drops to 1.5%.
- **Texas rates are quoted per $100 of value**, so "$0.85 per $100" is entered as 0.85%.
- **Appraisal cap:** a homestead's *taxable* value can rise at most 10% a year in Texas, even when the market
  rises faster. `PropertyValuation` tracks market value and taxable value separately; the gap shows on the Home
  value chart.
- **Home values grow** by a yearly rate (default 4.3%, the FHFA long-run average), which drives each year's bill.
  Insurance (+4.8%) and HOA dues (+4%) grow by their own rates.
- **Installments add up exactly:** a $5,000 yearly bill is 11 × $416.67 + $416.63, never $5,000.04.

---

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

![A 7/1 ARM's three paths: 6% for 84 payments, then 7.5% as expected, 11% in the worst case, or down to 4% and then the 2.75% margin floor](images/chart-arm-paths.svg)

In code: `AdjustableRate.RatePath()` produces the list of rate changes, and the ordinary amortization loop
re-amortizes whenever `loan.AnnualRateFor(period)` changes.

---

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

![A 2-1 buydown: $954.83 in year 1 and $1,073.64 in year 2, then $1,199.10; the subsidy of $4,436.76 covers the difference](images/chart-buydown.svg)

**Who pays for it decides what it saves.** The loan charges its note-rate interest either way ($231,677.04 on the
reference loan), and the principal paid each month does not change, so the subsidy pays interest:

- **The seller or builder pays** (a concession, the usual case): you pay **$231,677.04 − $4,436.76 = $227,240.28** of
  the interest. Each buydown saves a different amount: a 3-2-1 more than a 2-1, a 1-0 less.
- **You pay, at closing:** the subsidy is your own money, paid up front and returned as lower payments over the
  buydown years. It changes **when** you pay, not how much: you pay all $231,677.04.

`TemporaryBuydown.InterestYouPay` applies this to each schedule (with extra payments too: a loan paid off during the
buydown years needs less subsidy), and every schedule in the response carries `buydownSubsidy` and `interestYouPay`.
The headline and the rate plan say which case applies. (A **permanent** buydown is different: it lowers the note
rate for the whole loan. See [Discount points](#discount-points).)

---

## Discount points

A **permanent** buydown: a fee at closing, `points × loan ÷ 100` to the cent, for a lower note rate for the whole
loan. Whether it pays is a comparison with the same loan at the rate the lender quotes without points, each on its
standard schedule (extra payments left out, so the answer is about the points alone):

| One point on the reference loan | |
|---|---|
| Cost | 1% of $200,000 = **$2,000** |
| Payment | $1,231.43 at 6.25% → $1,199.10 at 6%: **$32.33** a month less |
| Interest over the loan | $243,319.13 → $231,677.04: **$11,642.09** saved, **$9,642.09** after the cost |
| Break-even | Payment **48**, when the interest saved ($2,004.68) first covers the cost |

- **The break-even counts interest, not payments,** the same rule as the refinance break-even (one shared domain
  method, `InterestBreakEven`): principal repaid is not a cost.
- Sell or refinance before the break-even and the points cost more than they saved; the results say so.
- **Not with an adjustable rate:** the two versions of the loan would reset differently, so there is no fair
  comparison. The validator refuses the combination.

---

## Cash to close

What the buyer brings to closing, as a Loan Estimate works it out. Each daily or monthly amount is rounded to the
cent **before** it is multiplied, because that is the number the Loan Estimate prints ("$63.44 per day for 15 days"):

```text
daily interest  = round(loan × rate ÷ 365)                 $356,250 at 6.5%  → $63.44
monthly escrow  = round((year-1 taxes + year-1 insurance) ÷ 12)   (7,150 + 2,400) ÷ 12 → $795.83

closing costs   = loan costs + other fees + daily interest × days + year-1 insurance
                  + monthly escrow × months + (a buydown the buyer pays for) + (discount points)
lender credits  = min(lender's offer, closing costs)
seller room     = min(seller's offer, closing costs − lender credits)
concessions     = seller's buydown + seller room − (for VA: the part of it paying fees, prepaid interest and points)
over the limit  = max(0, concessions − limit)
seller credits  = seller room − min(over the limit, the part of seller room that counts)
cash to close   = down payment + closing costs − lender credits − seller credits
```

| Reference purchase | |
|---|---|
| Fees | $4,000 + $1,000 |
| Prepaid interest | 15 days × $63.44 = $951.60 |
| Insurance, first year | $2,400.00 |
| Escrow | 3 months × $795.83 = $2,387.49 |
| **Closing costs** | **$10,739.09** |
| Cash to close, with $3,000 of credits | $18,750 + $10,739.09 − $3,000 = **$26,489.09** |

- **Interest is at the note rate**, even with a buydown: the subsidy pays monthly payments, not interest before the
  first one. An adjustable rate uses its starting rate.
- **365 days**, the common US convention for prepaid interest (some lenders use 360; the difference on this loan is
  $0.88 a day).
- **Credits never pay the down payment.** Seller and lender credits may pay closing costs and prepaids, not the
  buyer's own down payment, so any beyond the costs are reported as unused rather than taken off.
- **The seller's are limited** (Fannie Mae's "interested party contributions"): a conventional loan allows 3% of the
  price with a loan above 90% of it, 6% from 75.01% to 90%, 9% at 75% or less (Selling Guide B3-4.1-02); FHA 6% (HUD Handbook
  4000.1, as HUD's FHA answers site states it); VA 4% of the reasonable value, besides the normal closing costs and
  discount points (VA Pamphlet 26-7, chapter 8, and VA.gov's funding fee and closing costs page). A buydown the seller pays for counts. Lenders take anything
  beyond the limit off the price instead, so here it is taken off the seller's credits and reported. With 5% down on
  the reference purchase the limit is 3%, **$11,250**; a $9,000 seller buydown and the $3,000 of credits is $750
  over it, so $2,250 of the credits are used and the cash to close is **$27,239.09**.
- The limit is on the price, as lenders figure it on the lower of the price and the appraised value; the next
  conventional tier is the down payment that leaves a loan of exactly 90% (or 75%), rounded up to the cent.
- The domain is `ClosingCosts`, `CashToClose` and `ConcessionLimit` (`Domain/Closing`); the Python model in `tools/calculator-check`
  prices the same lines independently, and 300 random purchases match it to the cent.

### Can you afford it?

Lenders qualify a buyer on debt-to-income: the housing payment as a share of gross monthly income (the "front-end"
ratio), and it with the other monthly debts (the "back-end").

```
monthly income   = income a year ÷ 12, to the cent
housing payment  = principal and interest at the note rate + the first month's taxes, insurance, PMI or MIP, dues, PID
housing %        = housing payment ÷ monthly income × 100, to two decimals
total %          = (housing payment + other debts) ÷ monthly income × 100
most for housing = min(income × total limit − debts, income × housing limit), rounded down to the cent, never below 0
```

- **The limits:** comfortable is 28% and 36%. The most allowed is the program's: conventional 45% in all (Fannie
  Mae's Selling Guide B3-6-02, for a manually underwritten loan with the credit score and reserves its matrix asks;
  its automated underwriting goes to 50%). FHA is 31% and 43% (HUD's 2013 manual underwriting
  rule in the Federal Register, and Mortgagee Letter 2014-02, which lets compensating factors raise them to 37%/47% and
  40%/50%). VA is 41% in all (38 CFR 36.4340); past it, VA asks for residual income 20% over its guideline.
- **A temporary buydown is qualified at the note rate**, as Fannie Mae requires, so its first years do not help.
- **The highest price** keeps the down payment's share of the price (rounded up to the cent, so a program's minimum
  is never missed), the rate and every cost, and changes only the price. The payment rises with the price, but through
  taxes after exemptions and mortgage insurance that no formula inverts, so the price is searched: doubling from this
  home's price until the budget is passed, then halving the gap to the whole dollar. A price no loan can have (past a
  county's FHA limit) counts as beyond reach.
- Each price needs only the first month's payment, not a schedule (`HousingCostPlan.FirstMonth`), so the search adds
  about 10 ms to a calculation. FHA's MIP still needs the original schedule.
- On the reference purchase ($250,000, 5% down, 6.5%, Texas taxes) with $90,000 a year and $400 of debts, the
  comfortable limit allows **$2,100** for housing (28% of $7,500; 36% less the debts would be $2,300).
- The domain is `DebtToIncome`, `DebtToIncomeLimit` and `MostAffordable` (`Domain/Affordability`), and
  `AffordabilityAnalysis` (`Application/Services`). The Python model finds every price its own way, from its own
  first-month costs, and the random purchases include incomes from $40,000 to $400,000.

### Rent or buy

Two households that spend the same each month: one buys, one rents a similar home. Month by month, for up to 30
years (or the loan's term):

```
owning      = principal and interest + housing costs − a buydown's subsidy + upkeep
upkeep      = home value that year × upkeep % ÷ 12, to the cent
rent        = the rent × (1 + rise %)^(year − 1), to the cent
buyer       = buyer × (1 + return % ÷ 12) + max(0, rent − owning)
renter      = renter × (1 + return % ÷ 12) + max(0, owning − rent)      (starting with the cash to close)
```

At each year's end the buyer is worth the home's value then, less what is owed and the selling costs, plus their
investments; the renter, their investments. Buying **breaks even** in the first year from which it is ahead (or level)
every year after; one good year followed by a bad one does not count.

- It uses the loan's standard schedule: extra payments are an investment choice, like the renter's.
- Left out: taxes on investment gains, the mortgage interest deduction (most households take the standard deduction),
  and renters insurance.
- On the reference loan ($200,000 at 6%, $1,199.10 a month) with $50,000 to close against $1,200 of rent and nothing
  else, after a year the buyer has **$52,456.01** of equity and **$10.80** invested; the renter has the **$50,000**.
- The domain is `RentOrBuyComparison` (`Domain/RentOrBuy`), and `RentOrBuyAnalysis` (`Application/Services`). The
  Python model compares every year its own way: 300 of 300 random purchases match, 130 of them with a rent.

### The best use of the seller's money

The offer is the seller's credits plus a buydown they pay for. Each way to take it is the same request analyzed again
as it would be, with no extra payments, so it is priced exactly as the calculator prices any loan:

```
off the price    price − offer, the same down payment, no seller credits     (only when it leaves a loan)
toward closing   seller credits = offer
2-1 buydown      seller's share = min(offer, subsidy, limit)
                 the buyer pays subsidy − share at closing; seller credits = offer − share
points           budget = min(offer, limit)                                   (VA: the offer; its limit leaves points out)
                 points = min(5, ⌊budget ÷ loan × 100, to a thousandth⌋)
                 rate   = max(0, rate − points × cut per point), to a thousandth, half up; seller credits = offer
```

Each is costed over the years kept (up to the loan's end):

```
cost = cash to close + Σ (principal + interest + housing costs − buydown subsidy) + the balance still owed
```

- The balance counts because a price cut or points leave less owed: comparing payments alone would miss that.
- **Not used** is the part of the offer that pays nothing: beyond the closing costs, or the limit. A price cut uses all
  of it.
- The best is the lowest cost. Not with an adjustable rate (points and buydowns are priced differently) or with
  points of the buyer's own, which already set the rate.
- On the reference purchase ($250,000, 5% down, 6.5%) with $5,000 offered, $5,000 is **2.105 points**, and the rate
  is 6.5 − 2.105 × 0.25 = 5.97375, so **5.974%**. A 2-1 buydown costs $5,405.28, so the buyer pays $405.28 of it.
- The domain is `SellerOffer` and `OwnershipCost` (`Domain/Closing`), and `SellerOfferComparison` runs the ways
  (`Application/Services`). The Python model reruns each way its own way, and the random purchases ask for it.

---

## Refinancing

Compare the rest of the current loan with a new one. Reference: **$300,000 left at 7%, 25 years to go**
($2,120.34 a month), refinanced to **6% for a new 30 years** with $6,000 closing costs.

![The refinance trap: the new loan's balance stays higher and ends 60 payments later, so a payment $321.69 lower still costs $17,415.28 more](images/chart-refinance.svg)

| Result | Value |
|---|---|
| New payment | **$1,798.65**, $321.69 a month lower |
| Lifetime savings | **−$17,415.28**: the refinance costs *more* overall |
| Why | The clock restarts: **60 more payments**, mostly interest again |
| Break-even | Payment **25**, when the interest saved first covers the closing costs |
| The same, on a home worth $360,000, with $120 of PMI now | Both loans carry PMI to $288,000 (80%): the new one $125 a month, for longer, so it costs **$18,440** more and breaks even at payment **26** |
| Keep paying $2,120.34 on the new loan | Paid off in **247 payments**, and **$107,590.12** saved |

Key ideas:
- **Lifetime savings** = everything still owed on the current loan − (everything paid on the new one + closing
  costs paid up front).
- **Break-even counts interest, not payments**: principal repaid isn't a cost. The common "closing costs ÷
  monthly savings" overstates the benefit when costs are financed or the term is longer.
- **PMI counts wherever the payment does**, given the home's value: in the monthly change, the lifetime totals and the
  break-even. A new 30 years keeps PMI longer, and borrowing the closing costs can push the new loan back above 80%.
- The loan today can be entered as **what's owed now**, or as **the original loan** (amount, term, first
  payment), from which the server works out the balance on that loan's own schedule.
- A buydown on the new loan is paid at closing, so it changes **when** you pay, not how much.

---

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
- **The tax rates are the household's own,** federal plus state. The form shows the 2026 federal bracket and the
  long-term gains rate for the income, filing status and deductions entered, so a rate that doesn't fit the income
  stands out: $120,000 jointly is the 12% bracket; $500,000 is 32%, with 3.8% more on investment income.
- **PMI** is paid from the same budget until the balance is 80% of the home's value, so paying down ends it sooner: a
  return investing does not earn. From 2026 it is deductible like interest, phasing out by 10% for each $1,000 of
  income over $100,000 (pay less the 401(k) contribution), so none from $110,000.
- Net worth counts every account **after the tax still owed**: a 401(k) at the income tax rate, capital gains on
  taxable growth, a Roth tax-free.

**The hybrid's split** compares what a dollar earns on the mortgage, after tax (the rate, less the share of the
interest the deduction actually gives back: all of the tax rate only when every dollar is deducted, about 1% of it for
a household that itemizes by a little),
with what it earns invested, after tax. Stock that arrives anyway (RSUs kept as shares, ESOP) counts toward the
market share, so someone already heavy in company stock leans toward the mortgage. An **ARM** uses its average
rate over the payments left; a **buydown's** subsidy frees cash in every strategy.

---

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
  or not the loan is paid off early. Mortgage insurance, the balance and equity follow the plan with its extra
  payments instead: PMI stops when the loan actually paid reaches 80%, as the overview says.
- **Savings leave out costs that do not go away.** A shorter loan collects taxes and insurance through escrow for
  fewer months, but the owner keeps paying them. `LoanComparison.NetSavings` counts only interest and PMI, less recast
  fees, and a test locks that in.

---

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
