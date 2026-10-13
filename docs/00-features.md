# 0. What it does

> **Three questions a home owner actually has, answered with the real rules behind each.**
>
> 1. **What will this home really cost me?** [The calculator](#the-calculator)
> 2. **Should I refinance?** [Refinance](#refinance)
> 3. **Should spare cash pay down the mortgage, or be invested?** [Pay off or invest](#pay-off-or-invest)
>
> A loan typed on one page is carried to the others, and an [account](#accounts-and-history) saves any result to
> reopen later. The calculators themselves need no account.

**Read time:** 10 min · **Best for:** what the app does, before how · **The formulas:** [6. The mortgage math](06-mortgage-math.md)

**On this page:** [The calculator](#the-calculator) · [Refinance](#refinance) ·
[Pay off or invest](#pay-off-or-invest) · [Across the pages](#across-the-pages) ·
[Accounts and History](#accounts-and-history)

---

## The calculator

What a purchase costs month by month and year by year, and what extra payments do to it.

![The calculator's Overview: a $375,000 home with 5% down and $200 a month extra, with the net savings, the monthly payment broken down, and the balance over time](images/calculator.png)

### The loan

- **Home price and down payment in, loan out.** The loan amount, down-payment percentage and loan-to-value are
  derived, so they can never disagree. The down payment can be typed in dollars or as a percentage (a **$ | %**
  switch converts it; the API always receives dollars).
- **Principal and interest** use the standard annuity formula in exact `decimal`, with interest rounded to the cent
  each month. The final payment absorbs the rounding, so every schedule ends at exactly **$0.00**.
- **A loan you already have.** Enter its real first payment: a date in the past makes the schedule start there, so
  the dates, the balance and PMI follow the original loan. The form says which payment is next and roughly what is
  owed; extra payments start with the next payment due, and a lump sum on a payment already made is flagged.

### Loan types

| Loan | Down payment | Mortgage insurance and fees |
|---|---|---|
| **Conventional** | Any | PMI below 20% down (see the costs below) |
| **FHA** | At least 3.5% (10% with a credit score from 500 to 579; none below 500) | A **1.75% upfront MIP**, and an **annual MIP** from HUD's table: 0.55% of the balance for most 30-year loans with less than 5% down, 0.50% with 5% or more; lower on 15-year loans, higher above the national conforming limit ($832,750 in 2026). It lasts **11 years** at 90% LTV or less, otherwise the **whole loan**. The loan must be within **the county's limit**: pick the state and county, and the form shows HUD's 2026 limit there ($541,287 in most counties, up to $1,249,125) |
| **VA** | None needed | A **funding fee**: 2.15% with less than 5% down (3.3% when used before), 1.5% with 5%, 1.25% with 10%; none for veterans compensated for a service-connected disability. **No mortgage insurance** |

The upfront fee is added to the loan unless you choose to pay it at closing (then it is a cash-to-close line), so
the payment, interest and equity are on the whole amount borrowed. FHA's MIP is a twelfth of the annual rate on each
loan year's average balance on the original schedule, as HUD figures it; paying the loan off ends it, so extra
payments save it, and the results call it MIP, not PMI. $300,000 with 3.5% down borrows $294,566.25 with the upfront
MIP, and the first year's MIP is $134.33 a month.

### Rate types

- **Fixed** for the whole loan.
- **Temporary buydowns** (1-0, 2-1, 3-2-1, 1-1). Each bought-down year is paid at the payment on the original amount,
  over the full term, at the reduced rate; a subsidy covers the rest. The loan itself stays at its note rate, so its
  interest and payoff do not change. A 2-1 on $356,250 at 5.99% is paid at $1,698.74, then $1,910.25, then $2,133.61,
  for a $7,899 subsidy.
  - **Every year, not just the first.** The results show a table with a row for each year of the buydown, then the
    note rate: what you pay each month (with that year's taxes, insurance and PMI, which rise each year, and the
    principal and interest under it), and what the buydown pays that year and each month ($5,218 then $2,680 on
    that loan), then its whole cost. The payment tile shows year 1 and where the payment ends up.

    ![A 2-1 buydown year by year: what you pay each month with that year's taxes and insurance, the principal and interest under it, and what the buydown pays that year and each month, then $8,108 in all](images/buydown.png)
  - **Who pays decides what it saves.** Paid by the seller or builder, the subsidy pays part of your early interest,
    so you pay that much less ($403,950 of that loan's $411,848, and a 3-2-1 saves more). Paid by you at closing, it
    only moves your money earlier. The headline and the rate plan say which.
- **Discount points** (a permanent buydown): a fee at closing, a percentage of the loan, for a lower rate for the
  whole loan. Give the points and the rate the lender quotes without them (the loan's rate is the one with them); the
  Overview sets the two payments side by side and says what the points cost, the payment by which the interest they
  save covers that, and what they save over the loan, or that they never pay for themselves. One point on $200,000,
  6% instead of 6.25%, costs $2,000, saves $32.33 a month, and pays for itself by payment 48. The cost is a line in
  the cash to close. Not with an adjustable rate, whose two versions would reset differently.
- **Adjustable rates** (5/1, 7/1, 10/1, 5/6, 7/6, 10/6). The starting rate holds for the fixed period; each reset
  re-amortizes the balance over the payments left and moves toward the rate you expect, as far as the caps allow
  (first reset / later resets / lifetime, such as 5/2/5), and never below the **margin**, the rate's floor.
  - The results show each reset and its payment, and the **worst case**: rates rising as far and as fast as the caps
    allow, with the peak payment and total interest.
  - Extra payments lower the payment at each reset, as lenders re-amortize the smaller balance.

### Extra payments and recasting

- **Extra payments:** monthly, yearly and one-time lump sums, in any combination. An extra payment larger than the
  balance is capped.
- **Recasting** keeps the payoff date and lowers the payment instead. A lender recasts only after **one payment of
  at least its minimum** (default $10,000, never below $1,000), for a fee (default $250). Several smaller payments in
  a month do not add up to a qualifying one, and smaller extras still shorten the term. Each recast is listed with
  the old payment, the new payment and the fee.
- **Net savings = interest saved + PMI saved − recast fees.** Taxes, insurance and dues are left out on purpose: they
  continue after the loan is paid off.

### The full cost of owning

| Cost | How it works |
|---|---|
| **Property tax** | One combined rate by default, as most tax bills quote it, with a homestead exemption in dollars. Or, as in Texas, three taxing units: **school**, **county/city** and **MUD**, each on its own taxable value ("per $100" rates are entered as they are: $0.85 per $100 = 0.85%). Each year's bill is split into twelve installments that add up to it exactly. |
| **Homestead exemptions** | For a primary residence. School tax exempts a fixed amount ($140,000 in Texas); county/city tax can exempt a percentage (up to 20%, never less than $5,000: Texas Tax Code §11.13(n)); a MUD may grant its own percentage. Each exemption lowers only its own tax, as the law says. The form shows what they save in year 1. |
| **Over 65 or disabled** | From the year the owner qualifies: an extra school exemption ($60,000 in Texas since 2025) and a **school tax ceiling** that freezes school tax at that year's amount (it can fall, never rise). Counties and cities may add their own. An owner who **moves with a ceiling** keeps the same share of school tax at the new home (Texas Tax Code §11.26(g)): enter the share paid at the old one. |
| **Rate changes** | Each taxing unit adopts a new rate every year. **+ Add a tax rate change** gives a year and a new rate for each tax charged (blank keeps it); it applies from that year until the next change. A ceiling is set at the qualifying year's own rate, so a higher rate later can't raise the tax above it, and a lower one brings it down. |
| **Appraisal cap** | A homestead's *taxable* value rises at most a set percentage a year (10% in Texas), even when the market rises faster. |
| **PID assessment** | A fixed yearly amount, optionally ending after the district's remaining years. |
| **Insurance and HOA** | A yearly premium and monthly dues. |
| **PMI** | Only below **20% down**, as a percentage of the *original* loan. It comes off **on request at 80%**, using the actual balance (extra payments bring it forward, and that saving counts in net savings), which is the default, since a borrower paying extra asks as soon as they can. Or it comes off **automatically at 78%** of the original value, measured on the original schedule, which extra payments do not move. The PMI tile says what the other way would do: on the example, not asking keeps it until Jan 2038 instead of Dec 2033, costing $7,274 more. |
| **Future increases** | Home value growth drives each year's tax (within the cap); insurance and dues rise at their own rates. The defaults are long-run US averages, cited in the form: home values +4.3% a year (FHFA House Price Index, 1975–2025), insurance +4.8% (GAO-26-107867: $2,235 in 2019 to $2,829 in 2024), HOA dues +4%. |

### Cash to close

What you bring to closing besides the monthly payment, laid out as page 2 of a Loan Estimate lays it out
(**Closing costs**, under More details):

| Line | How it works |
|---|---|
| **Loan costs** and **other fees** | Typed in from the Loan Estimate: its total D (origination, appraisal, title), then sections E and H (recording fees, transfer taxes, an owner's title policy). |
| **Prepaid interest** | A day's interest at the note rate (loan × rate ÷ 365, to the cent), for the days from closing to the end of that month: $356,250 at 6.5% is $63.44 a day, so 15 days is $951.60. |
| **Homeowners insurance** | The first year's premium, always paid at closing. |
| **Escrow deposit** | Months of the first year's property taxes and insurance, a month being a twelfth of the year to the cent: (7,150 + 2,400) ÷ 12 = $795.83, so 3 months is $2,387.49. PID, HOA dues and PMI are not escrowed here. |
| **A buydown you pay for** | Its whole subsidy is paid at closing; a seller's buydown is not your money, so it is not in the total. |
| **Credits** | From the seller or lender, they pay closing costs and never the down payment: credits beyond the costs are shown as unused. |

The Overview lists each line with how it was worked out, and the total. The example's $5,000 of fees, 15 days of
interest and 3 months of escrow on the $375,000 home come to **$10,739.09** on top of the $18,750 down payment.

### The results

- **Overview:** one headline number. With extra payments it is the net savings, with the new total interest against
  the original; without them, the total interest over the loan (never a $0 saving). Then the monthly payment, when
  the loan is paid off and how much sooner, and when PMI ends; the payment breakdown; and the balance over time,
  with the gap between the two payoffs shaded; and the cash to close.
- **Projection:** the **quick numbers** for any year (each cost that year, through that year, and over the whole
  loan), then the yearly costs as stacked areas, the home's market value against what each tax is charged on, and
  your **equity**: what is still owed (on your plan, extra payments included) stacked under what is yours, so the top
  edge is the home's value. It starts at the down payment, and is the whole home from the year the loan is paid off.
  The year starts where the loan is now; pick another, or click the chart.
- **Schedule:** every payment, monthly or by year, with or without the extra payments, totals for every cost, and a
  **Columns** picker to show any cost as its own column. Recasts and the end of PMI are tagged on their row.

<p>
  <img src="images/projection.png" alt="The Projection tab: each cost in year 1, through year 1 and over all 30 years, above the yearly costs as stacked areas" width="49%" />
  <img src="images/schedule.png" alt="The Schedule tab: lifetime totals for every cost, then one row per payment with principal, interest, extra, housing costs and balance" width="49%" />
</p>

---

## Refinance

The rest of the current loan against a new one, with closing costs paid at closing or added to the loan.

![Refinance: refinancing to 6% costs $17,415 more over the life of the loan](images/refinance.png)

- **The verdict over the life of the loan,** closing costs included, in green when refinancing saves and amber when
  it costs more. It catches the trap most calculators hide: a lower payment can cost more overall, because a new
  30-year loan restarts the amortization clock.
- **The monthly change, the months added, and the break-even:** the payment by which the interest saved covers the
  closing costs. That counts financed costs too, unlike the usual "costs ÷ monthly savings".
- **Keep paying today's payment.** When the new payment is lower, the new loan is also shown paid at today's payment:
  how to refinance without restarting the clock.
- **Your loan today, either way:** as what is owed now, or as the **original loan** (amount, term, first payment), from
  which the server works out the balance, the payments left and the next due date on that loan's own schedule.
- **Rate types on both loans.** An ARM on the current loan (its next reset counted from today, or from the original
  first payment); an ARM or a buydown on the new one, with each reset and the worst case. A buydown on a refinance is
  bought at closing, so it changes when you pay, not how much.

---

## Pay off or invest

Three ways to use the same spare cash, played out month by month for 30 years.

![Pay off or invest, in dark mode: invest the difference, with a bad-decade warning](images/pay-off-or-invest-dark.png)

- **The strategies.** **Debt free ASAP** (every extra dollar to the mortgage, then everything invested), **Invest the
  difference**, and a **Hybrid** that splits the cash. All three take the free money first (the full 401(k) match at
  its after-tax cost, and any ESPP discount) and spend exactly the same each month.
- **Three markets.** The expected return; a **risk-adjusted** return (expected minus 4, 2 or 0 points for a
  Conservative, Balanced or Aggressive profile); and a **lost decade first** (−1% a year, like 2000–2009). The
  recommendation rests on the risk-adjusted return and always says whether a bad decade would reverse it.
- **Taxes as they really work.** Mortgage interest saves tax only on itemized deductions above the **standard
  deduction** (2026 amounts, rising with inflation; $750,000 debt limit), year by year, so paying down early also
  shrinks the deduction. Net worth counts every account **after the tax still owed** (a 401(k) at the income tax rate,
  capital gains on taxable growth, a Roth tax-free).
- **The hybrid split** follows the after-tax rate difference, and counts **stock that arrives anyway** (RSUs kept, an
  ESOP) toward its market share, so someone already heavy in company stock leans to the mortgage.
- **Rate types.** An ARM (paying down earns the rate's average over the loan, and a reset that raises the payment
  leaves less to invest) or a buydown on a new loan (its subsidy frees cash in every strategy).
- **The results:** the recommendation, three cards (each led by how far it ends behind the leader), then the
  difference over time, net worth at years 5, 10, 15 and 30 (also in today's dollars), debt against investments, and
  why.

---

## Across the pages

<img src="images/phone.png" alt="The calculator on a phone: the answer first, with Edit your numbers to jump to the form" width="220" align="right" />

- **One loan, typed once.** The balance, rate, years left, home value and rate type are shared by every page. Change
  them on one page and the next page opened starts from them, saying where they came from; each page keeps its own
  other inputs. On the calculator the shared loan becomes a purchase (the price is the home's value, the term the
  years left, rounded to whole years, and the rounding never flows back). Only a loan you type, or a saved one you
  open, is shared: a page's own example never overwrites yours.
- **Results as you type.** There is no Calculate button: every valid change is sent after a short pause, and a newer
  change replaces an older one in flight.
- **Answer first.** On a phone the results come first and the form follows, with **Edit your numbers** to jump to it;
  a sticky bar keeps the payment and savings in view. On a wider screen the form sits in its own column.
- **A first visit.** Each form says its numbers are an example until the first edit.
- **Bookmarkable.** The calculator's Overview, Projection and Schedule tabs have their own URLs, and the back button
  works.
- **Light and dark mode,** following the system.

<br clear="right" />

---

## Accounts and History

- **Sign up** with an email and a password, and confirm the email from the link sent to it. A forgotten password is
  reset by email.
- **Save** any calculation, refinance comparison or pay-off-or-invest comparison under a name.
- **History** lists them newest first, filtered by kind or searched by name. Open one on its own page (every number
  is restored), rename it, or delete it. Each person sees only their own.

---

[Guide contents](README.md) · Next: [1. Tech stack](01-tech-stack.md) →
