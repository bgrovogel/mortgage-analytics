# Tools

Checks that keep the app and its documentation honest. Each one is independent of the C# engine on purpose: a test
that only compares the code with its own output proves it is consistent, not that it is right.

| Tool | What it does | Run it |
|---|---|---|
| [Calculator check](calculator-check/README.md) | An independent model of the purchase calculator and the refinance comparison, and a script that checks the live API against it, field by field | `python tools/calculator-check/compare_with_api.py` |
| [Rate check](rate-check/README.md) | An independent model of adjustable rates and temporary buydowns; prints the reference values the tests pin | `python tools/rate-check/rate_model.py` |
| [Strategy check](strategy-check/README.md) | An independent model of Pay off or invest, and a script that checks the live API against it | `python tools/strategy-check/compare_with_api.py` |
| [Doc check](doc-check/README.md) | Counts the tests with the test tools and fails when a count in the README or `docs/` is out of date (CI runs it) | `python tools/doc-check/doc_counts.py` |
| [Diagrams](diagrams/README.md) | Draws the docs' diagrams and charts as SVG, computing every chart from the reference loans and stopping if a number disagrees with the docs | `python tools/diagrams/make_diagrams.py` |

All five need Python 3.10+ and nothing else: they use only the standard library (`decimal` for the money).
The two comparison scripts need the API running on http://localhost:5080
(`dotnet run --project src/MortgageAnalytics.Api`).

How these fit into the testing approach: [Testing and quality](../docs/07-testing.md#independent-models).
