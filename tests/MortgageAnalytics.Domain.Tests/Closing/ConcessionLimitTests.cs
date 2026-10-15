using MortgageAnalytics.Domain.Closing;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Closing;

/// <summary>
/// The most a seller or builder may pay toward the buyer's costs: Fannie Mae's Selling Guide B3-4.1-02 for a
/// conventional loan (by loan-to-value), 6% for FHA, 4% for VA. The home is $415,000.
/// </summary>
[TestFixture]
public class ConcessionLimitTests
{
    private const decimal Price = 415_000m;

    private static ConcessionLimit ConventionalWith(decimal downPayment) =>
        ConcessionLimit.For(LoanProgram.Conventional, new PropertyPurchase(Price, downPayment));

    [Test]
    public void Conventional_WithLessThanTenPercentDown_Is3Percent_And10PercentDownRaisesIt()
    {
        var limit = ConventionalWith(37_350m);

        Assert.Multiple(() =>
        {
            Assert.That(limit.Percent, Is.EqualTo(3m), "a loan above 90% of the price");
            Assert.That(limit.Amount, Is.EqualTo(12_450m), "3% of $415,000");
            Assert.That(limit.NextTier, Is.EqualTo(new ConcessionTier(41_500m, 6m, 24_900m)), "10% down makes it 6%: $24,900");
        });
    }

    [Test]
    public void Conventional_WithTenPercentDown_Is6Percent_And25PercentDownRaisesIt()
    {
        var limit = ConventionalWith(41_500m);

        Assert.Multiple(() =>
        {
            Assert.That(limit.Percent, Is.EqualTo(6m), "a 90% loan is in the 75.01% to 90% tier");
            Assert.That(limit.Amount, Is.EqualTo(24_900m), "6% of $415,000");
            Assert.That(limit.NextTier, Is.EqualTo(new ConcessionTier(103_750m, 9m, 37_350m)), "25% down makes it 9%: $37,350");
        });
    }

    [Test]
    public void Conventional_JustShortOf25PercentDown_IsStill6Percent()
    {
        Assert.That(ConventionalWith(103_749.99m).Percent, Is.EqualTo(6m), "a loan a cent above 75% of the price");
    }

    [Test]
    public void Conventional_With25PercentDown_Is9Percent_TheMost()
    {
        var limit = ConventionalWith(103_750m);

        Assert.Multiple(() =>
        {
            Assert.That(limit.Percent, Is.EqualTo(9m), "a loan of 75% or less");
            Assert.That(limit.Amount, Is.EqualTo(37_350m), "9% of $415,000");
            Assert.That(limit.NextTier, Is.Null, "no tier above it");
        });
    }

    [Test]
    public void Conventional_NextTier_IsRoundedUpToTheCent_SoItReachesTheTier()
    {
        var limit = ConcessionLimit.For(LoanProgram.Conventional, new PropertyPurchase(333_333.33m, 10_000m));

        Assert.That(limit.NextTier!.DownPayment, Is.EqualTo(33_333.34m), "10% of $333,333.33 is $33,333.333, so a cent more than $33,333.33");
    }

    [Test]
    public void Fha_Is6Percent_WhateverIsPutDown()
    {
        var limit = ConcessionLimit.For(LoanProgram.Fha, new PropertyPurchase(Price, 14_525m));

        Assert.Multiple(() =>
        {
            Assert.That(limit.Percent, Is.EqualTo(6m), "FHA's limit has no tiers");
            Assert.That(limit.Amount, Is.EqualTo(24_900m), "6% of $415,000");
            Assert.That(limit.NextTier, Is.Null, "putting more down does not raise it");
            Assert.That(limit.ExcludesNormalClosingCosts, Is.False, "everything the seller pays counts");
        });
    }

    [Test]
    public void Va_Is4Percent_AndTheNormalClosingCostsDoNotCount()
    {
        var limit = ConcessionLimit.For(LoanProgram.Va, new PropertyPurchase(Price, 0.01m));

        Assert.Multiple(() =>
        {
            Assert.That(limit.Percent, Is.EqualTo(4m), "VA's limit");
            Assert.That(limit.Amount, Is.EqualTo(16_600m), "4% of $415,000");
            Assert.That(limit.NextTier, Is.Null, "no tiers");
            Assert.That(limit.ExcludesNormalClosingCosts, Is.True, "the seller may pay the normal closing costs and points besides");
        });
    }

    [TestCase(62_250, TestName = "AnInvestmentProperty_Is2Percent_With15PercentDown")]
    [TestCase(207_500, TestName = "AnInvestmentProperty_Is2Percent_WithHalfDown")]
    public void AnInvestmentProperty_Is2Percent_WhateverIsPutDown(decimal downPayment)
    {
        var purchase = new PropertyPurchase(Price, downPayment) { Occupancy = Occupancy.InvestmentProperty };

        var limit = ConcessionLimit.For(LoanProgram.Conventional, purchase);

        Assert.Multiple(() =>
        {
            Assert.That(limit.Percent, Is.EqualTo(2m), "Fannie Mae: 2% at every loan-to-value for an investment property");
            Assert.That(limit.Amount, Is.EqualTo(8_300m), "2% of $415,000");
            Assert.That(limit.NextTier, Is.Null, "putting more down does not raise it");
        });
    }

    [Test]
    public void ASecondHome_HasTheTiersOfAHomeLivedIn()
    {
        var purchase = new PropertyPurchase(Price, 41_500m) { Occupancy = Occupancy.SecondHome };

        Assert.That(ConcessionLimit.For(LoanProgram.Conventional, purchase), Is.EqualTo(ConventionalWith(41_500m)),
            "Fannie Mae's tiers cover a principal residence or a second home alike");
    }

    [Test]
    public void Conventional_CountsTheNormalClosingCosts()
    {
        Assert.That(ConventionalWith(37_350m).ExcludesNormalClosingCosts, Is.False, "all of a conventional loan's financing concessions count");
    }
}
