"""Tests for doc_counts: run with `python -m unittest discover tools/doc-check`."""

import unittest

from doc_counts import Rule, check, parse_dotnet_listing, parse_playwright_listing, with_totals

COUNTS = with_totals({"domain": 353, "application": 206, "infrastructure": 18, "api": 69, "conventions": 7,
                      "jest": 474, "e2e": 84, "axe": 13})


class TotalsTests(unittest.TestCase):
    def test_adds_the_dotnet_and_overall_totals(self):
        self.assertEqual((COUNTS["dotnet"], COUNTS["total"]), (653, 1211),
                         "five .NET projects make the .NET total; .NET, Jest and Playwright make the total")


class CheckTests(unittest.TestCase):
    def test_docs_that_match_the_counts_pass(self):
        docs = {"README.md": "Tests: 653 backend tests and 474 Jest tests."}
        rules = [Rule("README.md", r"([\d,]+) backend tests", "dotnet"), Rule("README.md", r"([\d,]+) Jest tests", "jest")]

        self.assertEqual(check(docs, rules, COUNTS), [], "every count is right, so there is nothing to report")

    def test_a_wrong_count_is_reported_with_its_file_line_and_the_real_number(self):
        docs = {"README.md": "Intro.\nTests: 652 backend tests."}

        problems = check(docs, [Rule("README.md", r"([\d,]+) backend tests", "dotnet")], COUNTS)

        self.assertEqual(problems, ["README.md:2: says 652, but there are 653 (dotnet)"],
                         "the problem names where the stale number is and what it should be")

    def test_about_means_the_total_to_the_nearest_ten(self):
        rule = [Rule("a.md", r"About ([\d,]+) tests", "total", "about")]

        self.assertEqual(
            (check({"a.md": "About 1,210 tests"}, rule, COUNTS), len(check({"a.md": "About 1,170 tests"}, rule, COUNTS))),
            ([], 1),
            "1,211 tests is 'about 1,210'; 'about 1,170' has drifted")

    def test_over_means_the_total_rounded_down_to_the_hundred(self):
        rule = [Rule("a.md", r"over ([\d,]+) tests", "total", "over")]

        self.assertEqual(
            (check({"a.md": "over 1,200 tests"}, rule, COUNTS), len(check({"a.md": "over 1,100 tests"}, rule, COUNTS))),
            ([], 1),
            "1,211 tests is 'over 1,200'; 'over 1,100' is true but stale")

    def test_a_rule_that_matches_nothing_is_reported(self):
        problems = check({"README.md": "Reworded: lots of backend tests."},
                         [Rule("README.md", r"([\d,]+) backend tests", "dotnet")], COUNTS)

        self.assertEqual(problems, ["README.md: no longer says '([\\d,]+) backend tests' (dotnet); update RULES to the new wording"],
                         "a rewording must not quietly switch its check off")

    def test_a_count_of_tests_that_no_rule_checks_is_reported(self):
        problems = check({"README.md": "Line one.\nThe 41 smoke tests run first."}, [], COUNTS)

        self.assertEqual(problems, ["README.md:2: '41 smoke tests' is a test count no rule checks; add one to RULES"],
                         "a new count in the docs cannot go unchecked")


class ParsingTests(unittest.TestCase):
    def test_counts_the_tests_dotnet_lists(self):
        listing = ("Test run for C:\\x\\Domain.Tests.dll (.NETCoreApp,Version=v10.0)\n"
                   "The following Tests are available:\n"
                   "    FirstTest\n"
                   "    SecondTest(1,2)\n"
                   "    SecondTest(3,4)\n")

        self.assertEqual(parse_dotnet_listing(listing), 3, "each listed test case counts, parameterised ones included")

    def test_reads_the_total_playwright_lists(self):
        self.assertEqual(parse_playwright_listing("  [chromium] › a.spec.ts:1:1 › x\nTotal: 84 tests in 10 files\n"), 84,
                         "the total comes from Playwright's own summary line")

    def test_reads_a_single_playwright_test(self):
        self.assertEqual(parse_playwright_listing("Total: 1 test in 1 file\n"), 1, "the singular form counts too")


if __name__ == "__main__":
    unittest.main()
