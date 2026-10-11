# Rate check

An independent model of adjustable rates and temporary buydowns, written in Python `Decimal` from the rules
(not translated from the C# engine). `python tools/rate-check/rate_model.py` prints the reference values pinned
in `tests/MortgageAnalytics.Domain.Tests/Loans/AdjustableRateTests.cs`, `TemporaryBuydownTests.cs` and
`tests/MortgageAnalytics.Application.Tests/Services/RateOptionTests.cs`.
