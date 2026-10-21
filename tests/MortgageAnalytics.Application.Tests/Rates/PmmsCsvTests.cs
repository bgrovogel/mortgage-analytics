using MortgageAnalytics.Application.Rates;

namespace MortgageAnalytics.Application.Tests.Rates;

/// <summary>
/// Reads Freddie Mac's Primary Mortgage Market Survey history, a CSV with a row for each week, newest last: the 30-year
/// and 15-year fixed averages, a percentage, on the Thursday they were published.
/// </summary>
[TestFixture]
public class PmmsCsvTests
{
    private const string Header = "date,pmms30,pmms30p,pmms15,pmms15p,pmms51,pmms51p,pmms51m,pmms51spread";

    private static string Csv(params string[] rows) => string.Join("\r\n", [Header, .. rows]) + "\r\n";

    [Test]
    public void TheLatestWeek_IsTheLastRow()
    {
        var rates = PmmsCsv.Parse(Csv("10/1/2026,7.28,,6.6,,,,,", "10/8/2026,7.4,,6.73,,,,,", "10/15/2026,7.41,,6.71,,,,,"));

        Assert.Multiple(() =>
        {
            Assert.That(rates?.AsOf, Is.EqualTo(new DateOnly(2026, 10, 15)), "the week of the last row, month first as the file writes it");
            Assert.That(rates?.ThirtyYearFixed, Is.EqualTo(7.41m), "the 30-year fixed average");
            Assert.That(rates?.FifteenYearFixed, Is.EqualTo(6.71m), "the 15-year fixed average");
        });
    }

    [Test]
    public void ABlankLineAtTheEnd_AndAByteOrderMark_DoNotMatter()
    {
        var rates = PmmsCsv.Parse("﻿" + Csv("10/8/2026,7.4,,6.73,,,,,") + "\r\n\r\n");

        Assert.That(rates?.ThirtyYearFixed, Is.EqualTo(7.4m), "the data is read all the same");
    }

    [Test]
    public void ALatestRowWithoutAFifteenYearRate_IsSkipped_ForTheLatestThatHasBoth()
    {
        var rates = PmmsCsv.Parse(Csv("10/8/2026,7.4,,6.73,,,,,", "10/15/2026,7.41,,,,,,,"));

        Assert.That(rates?.AsOf, Is.EqualTo(new DateOnly(2026, 10, 8)), "a half-published week is not used");
    }

    [Test]
    public void UnixLineEndings_AreReadToo()
    {
        var rates = PmmsCsv.Parse(Csv("10/8/2026,7.4,,6.73,,,,,").Replace("\r\n", "\n"));

        Assert.That(rates?.FifteenYearFixed, Is.EqualTo(6.73m), "either line ending");
    }

    [TestCase("")]
    [TestCase("   ")]
    [TestCase("<html><body>Access denied</body></html>")]
    [TestCase("date,pmms30,pmms30p,pmms15\r\n")]
    [TestCase("date,pmms30,pmms30p,pmms15\r\nnot-a-date,7.4,,6.7\r\n")]
    [TestCase("date,pmms30,pmms30p,pmms15\r\n10/15/2026,seven,,6.7\r\n")]
    public void ThingsThatAreNotTheSurvey_GiveNothing_RatherThanAWrongRate(string text) =>
        Assert.That(PmmsCsv.Parse(text), Is.Null, "an error page, an empty file or a malformed row is not a rate");

    [Test]
    public void AColumnsOrderThatChanged_IsFollowedByItsNames()
    {
        var rates = PmmsCsv.Parse("pmms15,date,pmms30\r\n6.7,10/15/2026,7.4\r\n");

        Assert.Multiple(() =>
        {
            Assert.That(rates?.ThirtyYearFixed, Is.EqualTo(7.4m), "found by name, not by position");
            Assert.That(rates?.FifteenYearFixed, Is.EqualTo(6.7m), "likewise");
        });
    }

    [TestCase("0")]
    [TestCase("-1")]
    [TestCase("30.01")]
    [TestCase("700")]
    public void ARateOutsideWhatALoanCouldHave_IsNotUsed(string rate) =>
        Assert.That(PmmsCsv.Parse(Csv($"10/15/2026,{rate},,6.7,,,,,")), Is.Null, "0% to 30% is what a loan can be, so anything else is a mistake in the file");
}
