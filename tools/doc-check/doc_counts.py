"""
Checks that every test count in the README and docs/ matches the real number of tests.

The counts come from the test tools themselves, without running the slow suites: `dotnet test --list-tests` for each
.NET project, `playwright test --list`, and a Jest run (Jest has no list mode). Each place a count appears in the docs
is a rule below. An exact count must match; "about N" must be the total to the nearest ten, and "over N" the total
rounded down to the hundred, so rounded wording stays true as the suites grow.

Two safety nets: a rule whose wording is no longer found fails (a rewrite cannot quietly switch its check off), and a
"N ... tests" phrase that no rule checks fails (a new count cannot go unchecked).

Usage, from the repository root (stop the dev API first, as for any build):  python tools/doc-check/doc_counts.py
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parents[2]


class Rule(NamedTuple):
    """One place a count appears: the file, a pattern whose first group is the number, and which count it states."""
    file: str
    pattern: str
    count: str
    kind: str = "exact"  # or "about" (nearest ten) or "over" (rounded down to the hundred)


def _table(file: str, row_format: str) -> list[Rule]:
    """The per-suite rows of a testing table, given how a row is written ('| {name} ({n})' or '| {name} | {n} |')."""
    names = {"domain": "Domain", "application": "Application", "infrastructure": "Infrastructure",
             "api": "API integration", "conventions": "Conventions"}
    return [Rule(file, row_format.format(name=re.escape(label), n=r"([\d,]+)"), key) for key, label in names.items()]


RULES: list[Rule] = [
    # README.md
    Rule("README.md", r"NUnit \+ NSubstitute: ([\d,]+) backend tests", "dotnet"),
    Rule("README.md", r"Jest: ([\d,]+) Angular unit tests", "jest"),
    Rule("README.md", r"Playwright: ([\d,]+) E2E tests", "e2e"),
    Rule("README.md", r"# ([\d,]+) NUnit tests", "dotnet"),
    Rule("README.md", r"# ([\d,]+) Jest unit tests", "jest"),
    Rule("README.md", r"# ([\d,]+) Playwright tests", "e2e"),
    Rule("README.md", r"\(([\d,]+) are axe accessibility scans\)", "axe"),
    Rule("README.md", r"([\d,]+) \.NET, [\d,]+ Jest and [\d,]+ Playwright tests", "dotnet"),
    Rule("README.md", r"[\d,]+ \.NET, ([\d,]+) Jest and [\d,]+ Playwright tests", "jest"),
    Rule("README.md", r"[\d,]+ \.NET, [\d,]+ Jest and ([\d,]+) Playwright tests", "e2e"),
    # docs/07-testing.md
    Rule("docs/07-testing.md", r"About ([\d,]+) automated tests", "total", "about"),
    *_table("docs/07-testing.md", r"\| {name} \| {n} \|"),
    Rule("docs/07-testing.md", r"\| Angular unit \| ([\d,]+) \|", "jest"),
    Rule("docs/07-testing.md", r"\| End-to-end \| ([\d,]+) \|", "e2e"),
    # docs/08-interview-guide.md
    Rule("docs/08-interview-guide.md", r"over ([\d,]+) tests run in CI", "total", "over"),
    Rule("docs/08-interview-guide.md", r"its ([\d,]+) tests run in under a second", "domain"),
    Rule("docs/08-interview-guide.md", r"\| Tests \| ([\d,]+) \.NET", "dotnet"),
    Rule("docs/08-interview-guide.md", r"· ([\d,]+) Jest ·", "jest"),
    Rule("docs/08-interview-guide.md", r"· ([\d,]+) Playwright \(", "e2e"),
    Rule("docs/08-interview-guide.md", r"\(([\d,]+) axe scans\)", "axe"),
    # docs/README.md
    Rule("docs/README.md", r"More\s+than\s+([\d,]+) tests", "total", "over"),
]

# A number followed, within three words, by "test" or "tests": the shape of a test count anywhere in prose.
TEST_COUNT_PHRASE = re.compile(r"(?<![\w,.])(\d[\d,]*) (?:[A-Za-z.+/-]+ ){0,3}tests?\b")

DOTNET_PROJECTS = {
    "domain": "tests/MortgageAnalytics.Domain.Tests",
    "application": "tests/MortgageAnalytics.Application.Tests",
    "infrastructure": "tests/MortgageAnalytics.Infrastructure.Tests",
    "api": "tests/MortgageAnalytics.Api.IntegrationTests",
    "conventions": "tests/MortgageAnalytics.Conventions.Tests",
}


def with_totals(counts: dict[str, int]) -> dict[str, int]:
    """Adds the .NET total and the overall total to the per-suite counts."""
    dotnet = sum(counts[key] for key in DOTNET_PROJECTS)
    return {**counts, "dotnet": dotnet, "total": dotnet + counts["jest"] + counts["e2e"]}


def _expected(rule: Rule, actual: int) -> int:
    if rule.kind == "about":
        return round(actual, -1)
    if rule.kind == "over":
        return actual // 100 * 100
    return actual


def _line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def check(docs: dict[str, str], rules: list[Rule], counts: dict[str, int]) -> list[str]:
    """Every problem with the docs' counts, as 'file:line: what is wrong'; empty when they are all right."""
    problems = []
    checked = {file: set() for file in docs}
    for rule in rules:
        text = docs[rule.file]
        matches = list(re.finditer(rule.pattern, text))
        if not matches:
            problems.append(f"{rule.file}: no longer says '{rule.pattern}' ({rule.count}); update RULES to the new wording")
        for match in matches:
            checked[rule.file].add(match.start(1))
            stated, expected = int(match.group(1).replace(",", "")), _expected(rule, counts[rule.count])
            if stated != expected:
                problems.append(f"{rule.file}:{_line_of(text, match.start(1))}: says {match.group(1)}, "
                                f"but there are {expected:,} ({rule.count})")
    for file, text in docs.items():
        for phrase in TEST_COUNT_PHRASE.finditer(text):
            if phrase.start(1) not in checked[file]:
                problems.append(f"{file}:{_line_of(text, phrase.start())}: '{phrase.group(0)}' is a test count "
                                "no rule checks; add one to RULES")
    return problems


def parse_dotnet_listing(text: str) -> int:
    """The number of tests `dotnet test --list-tests` printed: one indented line each, after its heading."""
    listed = text.split("The following Tests are available:", 1)[1]
    return sum(1 for line in listed.splitlines() if line.startswith("    ") and line.strip())


def parse_playwright_listing(text: str) -> int:
    """The total from `playwright test --list`'s summary line ('Total: 84 tests in 10 files')."""
    return int(re.search(r"^Total: (\d+) tests? in", text, re.MULTILINE).group(1))


def _run(command: list[str], cwd: Path) -> str:
    # npm's commands are .cmd scripts on Windows, which need the shell to start.
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, encoding="utf-8",
                            shell=os.name == "nt", check=False)
    if result.returncode != 0:
        sys.exit(f"{' '.join(command)} failed:\n{result.stdout}\n{result.stderr}")
    return result.stdout


def count_tests() -> dict[str, int]:
    """The real counts, from the test tools themselves."""
    client = ROOT / "client"
    counts = {key: parse_dotnet_listing(_run(["dotnet", "test", project, "--list-tests"], ROOT))
              for key, project in DOTNET_PROJECTS.items()}
    counts["jest"] = json.loads(_run(["npx", "jest", "--json", "--silent", "--coverage=false"], client))["numTotalTests"]
    counts["e2e"] = parse_playwright_listing(_run(["npx", "playwright", "test", "--list"], client))
    counts["axe"] = parse_playwright_listing(_run(["npx", "playwright", "test", "--list", "e2e/accessibility.spec.ts"], client))
    return with_totals(counts)


def main() -> None:
    counts = count_tests()
    print("Counts: " + ", ".join(f"{key} {value:,}" for key, value in counts.items()))
    docs = {file: (ROOT / file).read_text(encoding="utf-8") for file in sorted({rule.file for rule in RULES})}
    problems = check(docs, RULES, counts)
    if problems:
        sys.exit("The docs' test counts are out of date:\n" + "\n".join(problems))
    print(f"All {len(RULES)} counts in the docs match.")


if __name__ == "__main__":
    main()
