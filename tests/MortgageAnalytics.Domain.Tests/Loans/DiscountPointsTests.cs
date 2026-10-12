using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

/// <summary>
/// Discount points: a fee at closing, a percentage of the loan, for a lower rate for the whole loan. The reference is
/// $200,000 over 30 years at 6% with one point, against 6.25% without; expected values from tools/calculator-check.
/// </summary>
[TestFixture]
public class DiscountPointsTests : AmortizationTestBase
{
    private static readonly DateOnly FirstPayment = new(2026, 11, 1);

    private PointsComparison Compare(decimal points, decimal rateWithoutPoints, decimal rateWithPoints = 6m)
    {
        var withPoints = StandardSchedule(new LoanTerms(200_000m, rateWithPoints, 360, FirstPayment));
        var withoutPoints = StandardSchedule(new LoanTerms(200_000m, rateWithoutPoints, 360, FirstPayment));
        return new DiscountPoints(points, rateWithoutPoints).Compare(200_000m, withPoints, withoutPoints);
    }

    [TestCase(1, 200_000, 2_000)]
    [TestCase(1.375, 356_250, 4_898.44)]
    public void ThePointsCost_APercentageOfTheLoan_ToTheCent(decimal points, decimal loan, decimal cost)
    {
        Assert.That(new DiscountPoints(points, 7m).CostFor(loan), Is.EqualTo(cost), "a point is 1% of the loan; 1.375% of $356,250 is $4,898.4375");
    }

    [Test]
    public void APoint_LowersThePayment_AndPaysForItselfInInterest()
    {
        var comparison = Compare(points: 1m, rateWithoutPoints: 6.25m);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Cost, Is.EqualTo(2_000m), "1% of $200,000, paid at closing");
            Assert.That(comparison.MonthlySaving, Is.EqualTo(32.33m), "$1,231.43 at 6.25% against $1,199.10 at 6%");
            Assert.That(comparison.InterestSaved, Is.EqualTo(11_642.09m), "$243,319.13 of interest against $231,677.04 over the full term");
            Assert.That(comparison.NetSaving, Is.EqualTo(9_642.09m), "less the $2,000 the point cost");
            Assert.That(comparison.BreakEvenPayment, Is.EqualTo(48), "by payment 48 the interest saved ($2,004.68) covers the cost");
        });
    }

    [Test]
    public void MorePointsForTheSameRate_TakeLongerToPayOff()
    {
        Assert.That(Compare(points: 2m, rateWithoutPoints: 6.25m).BreakEvenPayment, Is.EqualTo(96), "twice the cost, about twice as long");
    }

    [Test]
    public void APointThatBuysTooLittle_NeverBreaksEven()
    {
        var comparison = Compare(points: 1m, rateWithoutPoints: 6.01m);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.BreakEvenPayment, Is.Null, "0.01% saves less interest over the whole loan than the point costs");
            Assert.That(comparison.NetSaving, Is.Negative, "so it loses money");
        });
    }

    [TestCase(0, 7, "Points", TestName = "No points")]
    [TestCase(5.01, 7, "Points", TestName = "More than five points")]
    [TestCase(1, 0, "rate without points", TestName = "A zero rate without points")]
    [TestCase(1, 30.01, "rate without points", TestName = "A rate without points over 30%")]
    public void RejectsPointsNoLenderOffers(decimal points, decimal rateWithoutPoints, string guard)
    {
        DomainAssert.Rejects(() => new DiscountPoints(points, rateWithoutPoints), guard, "points are a positive fee for a real rate");
    }

    [Test]
    public void AcceptsTheLimits()
    {
        DomainAssert.Accepts(() => new DiscountPoints(DiscountPoints.MaxPoints, LoanTerms.MaxAnnualInterestRate), "five points, and the highest rate a loan may have");
    }
}
