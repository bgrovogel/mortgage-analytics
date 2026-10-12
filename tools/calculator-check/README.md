# Calculator check

An independent model of the purchase calculator and the refinance comparison, written in Python `Decimal` from the
rules (not translated from the C# engine), and a script that checks the live API against it.

## Why

The expected values in the tests must not come from the code under test. This model is a second implementation,
written from the rules, so a disagreement means one of the two is wrong. It found a real one: a half-cent rounding
difference in monthly interest (7% ÷ 12 repeats forever, so interest is now balance × rate ÷ 1,200).

## Run it

```bash
dotnet run --project src/MortgageAnalytics.Api        # the API on http://localhost:5080
python tools/calculator-check/compare_with_api.py     # 300 purchases and 300 refinances: all identical in every field
python tools/calculator-check/compare_with_api.py 50  # a quicker run
```

The households are random but seeded, so every run sends the same requests. Any difference is printed with its JSON
path, the expected and actual values, and the request that produced it.

## What it checks

| Part | Every field compared |
|---|---|
| **Each monthly row** | Principal, interest, extra principal, each cost, the outlay, the balance, the rate, the buydown subsidy and the due date |
| **Each schedule** | Every total, the interest you pay after a buydown subsidy, PMI's end, the payoff, the recasts and the rate changes |
| **The rest** | The savings, every year of the projection (with what is owed and the equity), the buydown table (with who pays), the ARM's worst case, discount points, FHA and VA, and the cash to close |
| **Refinance** | Both loans, keeping today's payment, lifetime savings, months added and the break-even payment |

## What the model covers

- **Schedule:** extra payments, recasts, rate changes (ARM paths come from [`rate-check`](../rate-check/README.md)),
  and buydown subsidies, paid by the seller or by the borrower.
- **PMI:** both removal rules: automatic at 78% on the original schedule, or on request at 80% on the actual balance.
- **Property taxes:** one combined rate, or school, county/city and MUD with their own exemptions (percentage
  exemptions at least $5,000), the appraisal cap, and over-65 relief with its ceiling.
- **Tax rate changes** from given years, and an over-65 ceiling transferred from a former home as a share.
- **Other costs:** PID, insurance and HOA, with yearly growth, each yearly bill in twelve exact installments.
- **FHA and VA:** the upfront fee (financed or paid at closing), FHA's annual MIP by HUD's table on each year's
  average scheduled balance, and VA's funding fee by down payment and use.
- **Discount points:** the cost, both payments, the interest saved and the break-even, against the rate without them.
- **Cash to close:** the fees, prepaid interest at the daily rate, the first year's insurance, months of escrow, a
  buydown the borrower pays for, and credits capped at the closing costs.

## Files

| File | Purpose |
|---|---|
| `calculator_model.py` | The model |
| `compare_with_api.py` | Sends random requests to `POST /api/v1/amortization/calculate` and `POST /api/v1/refinance/analyze`, and compares every response with the model |

[All tools](../README.md)
