# Calculator check

An independent model of the purchase calculator and the refinance comparison, written in Python `Decimal` from the
rules (not translated from the C# engine), and a script that checks the live API against it.

- `calculator_model.py`: the model.
  - **Schedule:** extra payments, recasts, rate changes (ARM paths come from `tools/rate-check/rate_model.py`),
    buydown subsidies.
  - **PMI:** both removal rules (automatic at 78% on the original schedule, or on request at 80% on the actual
    balance).
  - **Property taxes:** one combined rate, or school / county-city / MUD with their own exemptions (percentage
    exemptions at least $5,000), the appraisal cap, and over-65 relief with its ceiling.
  - **Other costs:** PID, insurance and HOA, with yearly growth.
  - **Results:** twelve installments per yearly bill, the yearly projection and the savings.
  - **Refinance:** both loans, keeping today's payment, lifetime savings, months added and the break-even payment.
- `compare_with_api.py`: sends random households (seeded, so every run is the same) to
  `POST /api/v1/amortization/calculate` and `POST /api/v1/refinance/analyze`. It compares every field it models:
  - **Each monthly row:** principal, interest, extra, each cost, the outlay, the balance, the rate, the subsidy and
    the due date.
  - **Each schedule:** every total, PMI's end, the payoff, the recasts and the rate changes.
  - **The rest:** the savings, every year of the projection, the buydown table and the ARM's worst case.

```bash
dotnet run --project src/MortgageAnalytics.Api        # the API on http://localhost:5080
python tools/calculator-check/compare_with_api.py     # 300 purchases and 300 refinances: all identical in every field
python tools/calculator-check/compare_with_api.py 50  # a quicker run
```

Any difference is printed with its JSON path, the expected and actual values, and the request that produced it.
