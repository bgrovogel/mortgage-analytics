# Rate check

An independent model of adjustable rates and temporary buydowns, written in Python `Decimal` from the rules (not
translated from the C# engine).

## Why

The ARM and buydown tests pin exact payments and totals. Those numbers come from this model, written from the rules,
so the tests check the engine against a second implementation rather than against itself.

## Run it

```bash
python tools/rate-check/rate_model.py
```

It prints the reference values: each ARM path (resets within their caps, the margin floor, the worst case) and each
buydown's yearly payments and subsidy.

## Where the values are pinned

| Test | What it pins |
|---|---|
| `tests/MortgageAnalytics.Domain.Tests/Loans/AdjustableRateTests.cs` | Rate paths, resets, caps, the margin floor, the worst case |
| `tests/MortgageAnalytics.Domain.Tests/Loans/TemporaryBuydownTests.cs` | Each year's payment, the subsidy, the interest you pay |
| `tests/MortgageAnalytics.Application.Tests/Services/RateOptionTests.cs` | The same rules through the real engine, request to response |

The [calculator check](../calculator-check/README.md) reuses this model's ARM paths.

[All tools](../README.md)
