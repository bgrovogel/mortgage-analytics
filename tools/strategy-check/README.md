# Strategy check

An independent model of the Pay off or invest comparison, written in Python `Decimal` from the rules
(not translated from the C# engine), and a script that checks the live API against it.

- `strategy_model.py`: the model. `python strategy_model.py` prints the reference households whose
  numbers are pinned in `tests/MortgageAnalytics.Testing/ReferenceStrategies.cs`.
- `compare_with_api.py`: sends 300 random households (seeded, so every run is the same) to
  `POST /api/v1/strategies/compare` and compares every field of every response with the model: each year
  of each strategy in each market scenario, the monthly plan, every rate, the recommendation and the
  bad-decade winner.

```bash
dotnet run --project src/MortgageAnalytics.Api   # the API on http://localhost:5080
python tools/strategy-check/compare_with_api.py  # 300 random households: 300 identical in every field
```
