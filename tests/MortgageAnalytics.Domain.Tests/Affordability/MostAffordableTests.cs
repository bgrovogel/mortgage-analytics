using MortgageAnalytics.Domain.Affordability;

namespace MortgageAnalytics.Domain.Tests.Affordability;

/// <summary>
/// The highest price whose payment fits a budget, found by searching prices, since the payment depends on the price in
/// ways no formula inverts (taxes after exemptions, PMI by loan-to-value). The payment here is $500 of fixed costs and
/// 0.75% of the price a month: a budget of $3,500 fits $400,000 exactly.
/// </summary>
[TestFixture]
public class MostAffordableTests
{
    private static decimal? Payment(decimal price) => 500m + price * 0.0075m;

    [Test]
    public void ThePrice_IsTheHighestWholeDollarWhosePaymentFits()
    {
        Assert.Multiple(() =>
        {
            Assert.That(MostAffordable.Price(Payment, 3_500m, 250_000m), Is.EqualTo(400_000m), "exactly $3,500 at $400,000");
            Assert.That(MostAffordable.Price(Payment, 3_500.01m, 250_000m), Is.EqualTo(400_001m), "a cent more allows a dollar more ($3,500.0075)");
            Assert.That(MostAffordable.Price(Payment, 3_499.99m, 250_000m), Is.EqualTo(399_998m), "a cent less: $399,999 would be $3,499.9925, a fraction over");
        });
    }

    [Test]
    public void TheSearch_GoesAboveWhereItStarts()
    {
        Assert.That(MostAffordable.Price(Payment, 8_000m, 100_000m), Is.EqualTo(1_000_000m), "from $100,000 up to $1,000,000");
    }

    [Test]
    public void ABudgetTheFixedCostsAlreadyTake_AffordsNothing()
    {
        Assert.That(MostAffordable.Price(Payment, 500m, 250_000m), Is.Zero, "$500 is all fixed costs");
    }

    [Test]
    public void APriceTheLoanCannotHave_IsBeyondReach()
    {
        // Above $300,000 the loan is not allowed (a county's FHA limit, say): the payment is unknown, and unaffordable.
        static decimal? Capped(decimal price) => price > 300_000m ? null : Payment(price);

        Assert.That(MostAffordable.Price(Capped, 5_000m, 250_000m), Is.EqualTo(300_000m), "the budget would reach $600,000, the loan only $300,000");
    }

    [Test]
    public void AStartPastTheCap_StartsAtTheCap()
    {
        Assert.That(MostAffordable.Price(Payment, 10_000_000m, 3_000_000m, max: 2_000_000m), Is.EqualTo(2_000_000m), "never priced above the cap");
    }

    [Test]
    public void AStartOfNothing_StillSearches()
    {
        Assert.That(MostAffordable.Price(Payment, 3_500m, 0m), Is.EqualTo(400_000m), "from $1, doubling");
    }

    [Test]
    public void TheSearch_DoublesThenHalves_InAFewDozenPrices()
    {
        var tried = 0;
        decimal? Counted(decimal price) { tried++; return Payment(price); }

        MostAffordable.Price(Counted, 3_500m, 250_000m);

        Assert.That(tried, Is.LessThan(25), "two to pass the budget, then about 18 halvings: each price is a calculation, so jumping to the cap would cost more");
    }

    [Test]
    public void TheSearch_StopsAtTheMostAnyLoanCanBe()
    {
        Assert.That(MostAffordable.Price(Payment, 10_000_000m, 250_000m, max: 2_000_000m), Is.EqualTo(2_000_000m), "no higher than the cap");
    }
}
