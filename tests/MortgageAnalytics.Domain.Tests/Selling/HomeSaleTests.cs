using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Selling;
using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Domain.Tests.Selling;

/// <summary>
/// What selling the home leaves in hand at the end of a year: its value, less what is owed, the cost of selling and any
/// tax on the gain. A home that was lived in for two years has the first $250,000 of gain ($500,000 for a married couple
/// filing jointly) free of tax (IRC 121). Every expected value is worked by hand, on a $300,000 home rising 10% a year.
/// </summary>
[TestFixture]
public class HomeSaleTests
{
    private static readonly PropertyValuation Rising = new(300_000m, 10m);

    private static SaleAssumptions Assumptions(
        FilingStatus status = FilingStatus.SingleFiler, bool primary = true, decimal costs = 6m, decimal rate = 15m) =>
        new(costs, status, rate, primary);

    private static decimal[] Owing(decimal balance, int years = 30) => [.. Enumerable.Repeat(balance, years)];

    [Test]
    public void AGainUnderTheExclusion_IsFreeOfTax_AndTheProceedsAreWhatIsLeftAfterTheLoanAndTheCosts()
    {
        var year = HomeSale.Years(300_000m, Rising, Owing(280_000m), Assumptions())[1];

        Assert.Multiple(() =>
        {
            Assert.That(year.Year, Is.EqualTo(2), "the second year");
            Assert.That(year.HomeValue, Is.EqualTo(363_000m), "300,000 after two years at 10%");
            Assert.That(year.SellingCosts, Is.EqualTo(21_780m), "6% of 363,000");
            Assert.That(year.Gain, Is.EqualTo(41_220m), "363,000 less 21,780 is 341,220, over the 300,000 paid");
            Assert.That(year.TaxFreeGain, Is.EqualTo(41_220m), "all of it, under the $250,000");
            Assert.That(year.TaxOnGain, Is.EqualTo(0m), "nothing is taxed");
            Assert.That(year.NetProceeds, Is.EqualTo(61_220m), "363,000 less the 280,000 owed and the 21,780 of costs");
        });
    }

    [Test]
    public void AGainOverTheExclusion_IsTaxedAtTheGivenRate_OnlyOnWhatIsOver()
    {
        var year = HomeSale.Years(300_000m, Rising, Owing(250_000m), Assumptions())[7];

        Assert.Multiple(() =>
        {
            Assert.That(year.HomeValue, Is.EqualTo(643_076.64m), "300,000 after eight years at 10%");
            Assert.That(year.SellingCosts, Is.EqualTo(38_584.60m), "6% of 643,076.64");
            Assert.That(year.Gain, Is.EqualTo(304_492.04m), "643,076.64 less 38,584.60 is 604,492.04, over the 300,000 paid");
            Assert.That(year.TaxFreeGain, Is.EqualTo(250_000m), "the single filer's exclusion");
            Assert.That(year.TaxOnGain, Is.EqualTo(8_173.81m), "54,492.04 over the exclusion, at 15%");
            Assert.That(year.NetProceeds, Is.EqualTo(346_318.23m), "643,076.64 less 250,000 owed, 38,584.60 of costs and 8,173.81 of tax");
        });
    }

    [Test]
    public void AMarriedCouple_HaveAnExclusionOfHalfAMillion()
    {
        var year = HomeSale.Years(300_000m, Rising, Owing(250_000m), Assumptions(FilingStatus.MarriedFilingJointly))[7];

        Assert.Multiple(() =>
        {
            Assert.That(year.TaxFreeGain, Is.EqualTo(304_492.04m), "the whole gain is under $500,000");
            Assert.That(year.TaxOnGain, Is.EqualTo(0m), "nothing is taxed");
        });
    }

    [Test]
    public void AHeadOfHousehold_HasTheSingleFilersExclusion() =>
        Assert.That(
            HomeSale.Years(300_000m, Rising, Owing(0m), Assumptions(FilingStatus.HeadOfHousehold))[7].TaxFreeGain,
            Is.EqualTo(250_000m), "$250,000, as a single filer");

    [Test]
    public void SellingAfterOneYear_HasNoExclusion_BecauseTheHomeWasNotLivedInForTwo()
    {
        var year = HomeSale.Years(300_000m, Rising, Owing(280_000m), Assumptions())[0];

        Assert.Multiple(() =>
        {
            Assert.That(year.Gain, Is.EqualTo(10_200m), "330,000 less 19,800 of costs is 310,200, over the 300,000 paid");
            Assert.That(year.TaxFreeGain, Is.EqualTo(0m), "no exclusion yet");
            Assert.That(year.TaxOnGain, Is.EqualTo(1_530m), "all 10,200 taxed at 15%");
            Assert.That(year.NetProceeds, Is.EqualTo(28_670m), "330,000 less 280,000 owed, 19,800 of costs and 1,530 of tax");
        });
    }

    [Test]
    public void AHomeThatIsNotThePrimaryResidence_HasNoExclusion()
    {
        var year = HomeSale.Years(300_000m, Rising, Owing(250_000m), Assumptions(primary: false))[7];

        Assert.Multiple(() =>
        {
            Assert.That(year.TaxFreeGain, Is.EqualTo(0m), "a rental or second home gets none");
            Assert.That(year.TaxOnGain, Is.EqualTo(45_673.81m), "all 304,492.04 of gain at 15%");
        });
    }

    [Test]
    public void ALoss_IsNotTaxed_AndIsNotAnExclusion()
    {
        var year = HomeSale.Years(300_000m, new PropertyValuation(300_000m, -5m), Owing(250_000m), Assumptions())[2];

        Assert.Multiple(() =>
        {
            Assert.That(year.Gain, Is.LessThan(0m), "it sold for less than was paid");
            Assert.That(year.TaxFreeGain, Is.EqualTo(0m), "nothing to exclude");
            Assert.That(year.TaxOnGain, Is.EqualTo(0m), "nothing to tax");
        });
    }

    [Test]
    public void WhenWhatIsOwedIsMoreThanTheHomeFetches_TheProceedsAreNegative()
    {
        var year = HomeSale.Years(300_000m, new PropertyValuation(300_000m, -5m), Owing(300_000m), Assumptions())[0];

        Assert.That(year.NetProceeds, Is.LessThan(0m), "the seller has to bring cash to closing");
    }

    [Test]
    public void ItCoversAsManyYearsAsThereAreBalances() =>
        Assert.That(HomeSale.Years(300_000m, Rising, Owing(1m, years: 15), Assumptions()), Has.Count.EqualTo(15), "one per year of the loan");

    [TestCase(-0.01)]
    [TestCase(20.01)]
    public void SellingCosts_OutsideZeroToTwentyPercent_AreRefused(double percent) =>
        Assert.That(
            () => HomeSale.Years(300_000m, Rising, Owing(1m), Assumptions(costs: (decimal)percent)),
            Throws.TypeOf<DomainValidationException>(), "a market has no such costs");

    [TestCase(-0.01)]
    [TestCase(40.01)]
    public void ATaxRate_OutsideZeroToForty_IsRefused(double percent) =>
        Assert.That(
            () => HomeSale.Years(300_000m, Rising, Owing(1m), Assumptions(rate: (decimal)percent)),
            Throws.TypeOf<DomainValidationException>(), "no gains tax has such a rate");
}
