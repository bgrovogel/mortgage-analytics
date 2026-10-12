using MortgageAnalytics.Application.Contracts;
using Standard = MortgageAnalytics.Testing.ReferenceLoans.Standard;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for discount points: the reference loan, $200,000 at 6% for 30 years, bought down with one point
/// from 6.25%. Expected values from tools/calculator-check.
/// </summary>
[TestFixture]
public class DiscountPointsScenarioTests : SociableAnalysisTestBase
{
    [Test]
    public void APoint_IsComparedWithTheRateWithoutIt()
    {
        var points = Service.Analyze(A.Request.WithDiscountPoints(1m, 6.25m)).DiscountPoints!;

        Assert.Multiple(() =>
        {
            Assert.That(points.Cost, Is.EqualTo(2_000m), "1% of $200,000");
            Assert.That(points.PaymentWithoutPoints, Is.EqualTo(1_231.43m), "the payment at 6.25%");
            Assert.That(points.MonthlySaving, Is.EqualTo(1_231.43m - Standard.MonthlyPayment), "against $1,199.10 at 6%");
            Assert.That(points.InterestSaved, Is.EqualTo(11_642.09m), "over the full term");
            Assert.That(points.NetSaving, Is.EqualTo(9_642.09m), "less the cost");
            Assert.That(points.BreakEvenPayment, Is.EqualTo(48), "the interest saved covers the cost by payment 48");
            Assert.That(points.BreakEvenDate, Is.EqualTo(ReferenceLoans.FirstPaymentDate.AddMonths(47)), "October 2030");
        });
    }

    [Test]
    public void ThePointsArePaidAtClosing()
    {
        var response = Service.Analyze(A.Request.WithDiscountPoints(1m, 6.25m).WithClosingCosts(loanCosts: 0m, otherFees: 0m, prepaidInterestDays: 0, escrowMonths: 0));

        Assert.Multiple(() =>
        {
            Assert.That(response.CashToClose!.DiscountPoints, Is.EqualTo(2_000m), "a line of their own");
            Assert.That(response.CashToClose.ClosingCosts, Is.EqualTo(2_000m), "and part of the closing costs");
            Assert.That(response.CashToClose.Total, Is.EqualTo(Standard.DownPayment + 2_000m), "on top of the down payment");
        });
    }

    [Test]
    public void WithoutPoints_ThereIsNoComparison()
    {
        Assert.Multiple(() =>
        {
            Assert.That(Service.Analyze(A.Request).DiscountPoints, Is.Null, "no points, nothing to compare");
            Assert.That(Service.Analyze(A.Request.WithClosingCosts()).CashToClose!.DiscountPoints, Is.Zero, "and nothing paid for them");
        });
    }
}
