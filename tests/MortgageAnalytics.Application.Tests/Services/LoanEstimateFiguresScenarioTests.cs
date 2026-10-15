using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for the figures a Loan Estimate's comparison box shows: what is paid in the first five years,
/// the principal it pays off, and the total interest as a percentage of the loan. The loan is $200,000 at 6.5% over
/// 30 years, a payment of $1,264.14, on a $250,000 home with 20% down (no PMI). Expected values come from an
/// independent amortization in Python's Decimal.
/// </summary>
[TestFixture]
public class LoanEstimateFiguresScenarioTests : SociableAnalysisTestBase
{
    private static AmortizationRequestBuilder TwentyPercentDown() =>
        A.Request.WithHomePrice(250_000m).WithDownPayment(50_000m).WithRate(6.5m);

    [Test]
    public void InFiveYears_IsSixtyPayments_AndThePrincipalTheyPayOff()
    {
        var five = Service.Analyze(TwentyPercentDown()).InFiveYears!;

        Assert.Multiple(() =>
        {
            Assert.That(five.TotalPaid, Is.EqualTo(75_848.40m), "60 payments of $1,264.14");
            Assert.That(five.PrincipalPaidOff, Is.EqualTo(12_778.36m), "what they pay off of the $200,000");
        });
    }

    [Test]
    public void TheLendersLoanCosts_AreInWhatIsPaid()
    {
        var five = Service.Analyze(TwentyPercentDown().WithClosingCosts(loanCosts: 4_000m, otherFees: 1_000m)).InFiveYears!;

        Assert.That(five.TotalPaid, Is.EqualTo(79_848.40m), "the $4,000 of loan costs, not the $1,000 of other fees");
    }

    [Test]
    public void ExtraPayments_AreLeftOut_AsAnEstimateShowsTheStandardSchedule()
    {
        var withExtra = Service.Analyze(TwentyPercentDown().WithMonthlyExtra(500m));

        Assert.That(withExtra.InFiveYears!.TotalPaid, Is.EqualTo(75_848.40m), "the schedule without extra payments");
    }

    [Test]
    public void MortgageInsurance_IsInWhatIsPaid()
    {
        var plain = Service.Analyze(A.Request.WithHomePrice(250_000m).WithDownPayment(12_500m).WithRate(6.5m)).InFiveYears!;
        var withPmi = Service.Analyze(
            A.Request.WithHomePrice(250_000m).WithDownPayment(12_500m).WithRate(6.5m).WithHousingCosts(c => c.WithPmi(0.5m))).InFiveYears!;

        Assert.That(withPmi.TotalPaid - plain.TotalPaid, Is.EqualTo(98.96m * 60), "$98.96 of PMI a month for 60 months");
    }

    [Test]
    public void TotalInterestPercentage_OnAnFhaLoan_IsMeasuredAgainstTheLoanWithItsFinancedUpfrontPremium()
    {
        var response = Service.Analyze(A.Request.WithHomePrice(300_000m).WithDownPayment(10_500m).WithProgram(LoanProgramType.Fha));

        Assert.Multiple(() =>
        {
            Assert.That(response.Program!.LoanAmount, Is.GreaterThan(response.Purchase.LoanAmount), "the upfront premium is borrowed too");
            Assert.That(response.TotalInterestPercentage,
                Is.EqualTo(Math.Round(response.Baseline.TotalInterest / response.Program.LoanAmount * 100m, 3, MidpointRounding.AwayFromZero)),
                "the interest as a share of what is actually borrowed");
        });
    }

    [Test]
    public void TotalInterestPercentage_IsTheInterestOverTheLoanAsAShareOfIt()
    {
        Assert.That(Service.Analyze(TwentyPercentDown()).TotalInterestPercentage, Is.EqualTo(127.543m),
            "$255,085.82 of interest on $200,000, to a thousandth");
    }
}
