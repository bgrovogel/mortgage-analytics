# Doc check

Keeps every test count in the README and `docs/` true. CI runs it on every push.

## Why

The docs quote test counts in many places, and counts kept by hand drift. This counts the tests with the test tools
themselves and fails when a number in the docs no longer matches.

## Run it

```bash
python tools/doc-check/doc_counts.py              # stop the dev API first: it builds the test projects
python -m unittest discover tools/doc-check       # its own tests
```

A stale count is reported with its file and line:

```
README.md:112: says 475, but there are 474 (jest)
```

## How it works

1. **Count the tests:** `dotnet test --list-tests` for each .NET project, `playwright test --list` (all tests, and the
   axe scans), and a Jest run (Jest has no list mode).
2. **Check each rule.** Every place a count appears is a rule in `RULES`. An exact count must match; "about N" must be
   the total to the nearest ten; "over N" must be the total rounded down to the hundred, so rounded wording stays true.
3. **Two safety nets.** A rule whose wording is no longer found fails, so a rewrite cannot quietly switch its check
   off; and any "N ... tests" phrase that no rule checks fails, so a new count cannot go unchecked.

## Files

| File | Purpose |
|---|---|
| `doc_counts.py` | The rules, the counting and the check (standard library only) |
| `test_doc_counts.py` | Its tests |

[All tools](../README.md)
