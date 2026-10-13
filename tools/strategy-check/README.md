# Strategy check

An independent model of the Pay off or invest comparison, written in Python `Decimal` from the rules (not translated
from the C# engine), and a script that checks the live API against it.

## Why

Thirty years of month-by-month cash flows, taxes and three market scenarios are easy to get subtly wrong and hard to
check by hand. A second implementation written from the rules makes every number checkable. It found a real bug: a
100% employer match was being rejected by the validator.

## Run it

```bash
python tools/strategy-check/strategy_model.py    # prints the reference households
dotnet run --project src/MortgageAnalytics.Api   # the API on http://localhost:5080
python tools/strategy-check/compare_with_api.py  # 300 random households: 300 identical in every field
```

The households are random but seeded, so every run sends the same requests.

## What it checks

Every field of every response from `POST /api/v1/strategies/compare`:

- each year of each strategy in each market scenario;
- the monthly cash plan (free money first: the 401(k) match and any ESPP discount);
- PMI, paid until the balance is 80% of the home's value, and deducted below the income limit;
- every rate (after-tax mortgage and market rates, the hybrid split);
- the recommendation and the bad-decade winner.

## Files

| File | Purpose |
|---|---|
| `strategy_model.py` | The model; its reference households are pinned in `tests/MortgageAnalytics.Testing/ReferenceStrategies.cs` |
| `compare_with_api.py` | Sends random households to the API and compares every response with the model |

[All tools](../README.md)
