# Doc check

Keeps the test counts in the README and `docs/` true. `python tools/doc-check/doc_counts.py` counts the tests with
the test tools themselves (`dotnet test --list-tests` for each .NET project, `playwright test --list`, and a Jest
run, since Jest has no list mode), then checks every count in the docs and names each one that is out of date:

```
README.md:112: says 475, but there are 474 (jest)
```

Each place a count appears is a rule in `RULES`. An exact count must match; "about N" must be the total to the
nearest ten, and "over N" the total rounded down to the hundred. A rule whose wording is no longer found fails, and
so does any "N ... tests" phrase no rule checks, so a new count cannot go unchecked. CI runs it on every push.
`python -m unittest discover tools/doc-check` runs its own tests.
