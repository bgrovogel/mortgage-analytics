using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for the jumbo loan flag: a conventional loan above FHFA's conforming limit for the year it
/// closes (the month before its first payment). The limits are $806,500 for 2025 and $832,750 for 2026.
/// </summary>
[TestFixture]
public class JumboLoanScenarioTests : SociableAnalysisTestBase
{
    private static AmortizationRequestBuilder LoanOf(decimal loan, DateOnly firstPayment) =>
        A.Request.WithHomePrice(loan + 100_000m).WithDownPayment(100_000m).WithFirstPaymentDate(firstPayment);

    [Test]
    public void ALoanAboveTheLimitForTheYearItCloses_IsJumbo()
    {
        var purchase = Service.Analyze(LoanOf(820_000m, new DateOnly(2026, 1, 1))).Purchase;

        Assert.Multiple(() =>
        {
            Assert.That(purchase.ConformingLoanLimit, Is.EqualTo(806_500m), "closing in December 2025: that year's limit");
            Assert.That(purchase.IsJumbo, Is.True, "$820,000 is above $806,500");
        });
    }

    [Test]
    public void TheSameLoanClosingNextYear_IsWithinTheNewLimit()
    {
        var purchase = Service.Analyze(LoanOf(820_000m, new DateOnly(2026, 2, 1))).Purchase;

        Assert.Multiple(() =>
        {
            Assert.That(purchase.ConformingLoanLimit, Is.EqualTo(832_750m), "closing in January 2026");
            Assert.That(purchase.IsJumbo, Is.False, "$820,000 is within $832,750");
        });
    }

    [Test]
    public void ALoanAtTheLimit_IsNotJumbo()
    {
        Assert.That(Service.Analyze(LoanOf(832_750m, new DateOnly(2026, 2, 1))).Purchase.IsJumbo, Is.False, "at the limit is within it");
    }

    [Test]
    public void AGovernmentLoan_IsNeverJumbo()
    {
        var fha = LoanOf(900_000m, new DateOnly(2026, 2, 1)).WithProgram(LoanProgramType.Fha);

        Assert.That(Service.Analyze(fha).Purchase.IsJumbo, Is.False, "FHA and VA have their own limits, not the conforming one");
    }
}
