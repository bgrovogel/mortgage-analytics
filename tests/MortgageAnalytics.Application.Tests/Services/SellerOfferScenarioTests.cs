using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for the ways to take a seller's or builder's offer. The purchase is <see cref="FivePercentDown"/>:
/// $250,000 with $12,500 down, so $237,500 at 6.5%, with Texas taxes and PMI. The seller may pay up to 3%, $7,500.
/// Each way is checked against the same loan analyzed on its own, so the comparison adds no arithmetic of its own
/// beyond how the offer is split.
/// </summary>
[TestFixture]
public class SellerOfferScenarioTests : SociableAnalysisTestBase
{
    /// <summary>What a 2-1 buydown costs on the loan: 12 × $297.78 + 12 × $152.66.</summary>
    private const decimal TwoOneSubsidy = 5_405.28m;

    private static AmortizationRequestBuilder TexasPurchase() =>
        A.Request.FivePercentDown().WithHousingCosts(c => c
            .WithSchoolTax(1.0m).WithLocalTax(1.1m).WithMudTax(0.85m)
            .WithInsurance(2_400m).WithHoa(50m).WithPmi(FivePercentDown.PmiRate));

    private SellerOfferResponse OfferOf(decimal credits, AmortizationRequestBuilder? request = null) =>
        Service.Analyze((request ?? TexasPurchase()).WithClosingCosts(credits: credits).WithSellerOffer()).SellerOffer!;

    private static SellerOfferOptionResponse Way(SellerOfferResponse offer, SellerOfferUse use) => offer.Options.Single(o => o.Use == use);

    [Test]
    public void ThereIsNoComparison_UnlessAskedFor_WithAnOffer()
    {
        Assert.Multiple(() =>
        {
            Assert.That(Service.Analyze(TexasPurchase().WithClosingCosts(credits: 5_000m)).SellerOffer, Is.Null, "not asked for");
            Assert.That(Service.Analyze(TexasPurchase().WithClosingCosts().WithSellerOffer()).SellerOffer, Is.Null, "nothing offered");
            Assert.That(Service.Analyze(TexasPurchase().WithSellerOffer()).SellerOffer, Is.Null, "no closing costs to price the ways with");
            Assert.That(Service.Analyze(TexasPurchase().WithAdjustableRate(7.5m).WithClosingCosts(credits: 5_000m).WithSellerOffer()).SellerOffer,
                Is.Null, "an adjustable rate's points and buydowns are priced differently");
            Assert.That(Service.Analyze(TexasPurchase().WithRate(6.25m).WithDiscountPoints(1m, 6.5m).WithClosingCosts(credits: 5_000m).WithSellerOffer()).SellerOffer,
                Is.Null, "points of the buyer's own already set the rate");
        });
    }

    [Test]
    public void TheOffer_IsTheCredits_AndABuydownTheSellerPaysFor()
    {
        var sellers = OfferOf(3_000m, TexasPurchase().WithBuydown(2, 1));
        var buyers = OfferOf(3_000m, TexasPurchase().WithBuydown(2, 1).WithBuydownPaidBy(BuydownFunding.Borrower));

        Assert.Multiple(() =>
        {
            Assert.That(sellers.Offer, Is.EqualTo(3_000m + TwoOneSubsidy), "the credits and the subsidy");
            Assert.That(buyers.Offer, Is.EqualTo(3_000m), "a buydown the buyer pays for is their own money");
            Assert.That(sellers.YearsKept, Is.EqualTo(7), "costed over seven years unless asked otherwise");
            Assert.That(sellers.RateCutPerPoint, Is.EqualTo(0.25m), "a quarter point for each point");
        });
    }

    [Test]
    public void ToTheClosingCosts_IsTheLoanWithTheCredits()
    {
        var way = Way(OfferOf(5_000m), SellerOfferUse.ClosingCosts);
        var alone = Service.Analyze(TexasPurchase().WithClosingCosts(credits: 5_000m));

        Assert.Multiple(() =>
        {
            Assert.That(way.HomePrice, Is.EqualTo(250_000m), "the price as it is");
            Assert.That(way.LoanAmount, Is.EqualTo(237_500m), "and the loan");
            Assert.That(way.AnnualInterestRate, Is.EqualTo(6.5m), "at the rate as it is");
            Assert.That(way.Points, Is.Zero, "no points");
            Assert.That(way.CashToClose, Is.EqualTo(alone.CashToClose!.Total), "the credits come off the cash to close");
            Assert.That(way.FirstPayment, Is.EqualTo(alone.Baseline.TotalMonthlyPayment), "the payment does not change");
            Assert.That(way.LaterPayment, Is.EqualTo(way.FirstPayment), "nor later");
            Assert.That(way.NotUsed, Is.Zero, "$5,000 is within the costs and the limit");
        });
    }

    [Test]
    public void OffThePrice_IsASmallerLoan_WithNoCredits()
    {
        var way = Way(OfferOf(5_000m), SellerOfferUse.PriceCut);
        var alone = Service.Analyze(TexasPurchase().WithHomePrice(245_000m).WithClosingCosts());

        Assert.Multiple(() =>
        {
            Assert.That(way.HomePrice, Is.EqualTo(245_000m), "$5,000 off the price");
            Assert.That(way.LoanAmount, Is.EqualTo(232_500m), "with the same down payment, $5,000 less to borrow");
            Assert.That(way.CashToClose, Is.EqualTo(alone.CashToClose!.Total), "the buyer pays all the closing costs");
            Assert.That(way.FirstPayment, Is.EqualTo(alone.Baseline.TotalMonthlyPayment), "a lower payment, taxes and PMI included");
            Assert.That(way.NotUsed, Is.Zero, "a price cut is not a concession: all of it counts");
        });
    }

    [Test]
    public void ForABuydown_AnOfferShortOfTheSubsidy_LeavesTheBuyerTheRest()
    {
        var offer = OfferOf(5_000m);
        var way = Way(offer, SellerOfferUse.TemporaryBuydown);
        var buyerPaysAll = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithBuydownPaidBy(BuydownFunding.Borrower).WithClosingCosts());

        Assert.Multiple(() =>
        {
            Assert.That(way.CashToClose, Is.EqualTo(buyerPaysAll.CashToClose!.Total - 5_000m), $"the buyer pays ${TwoOneSubsidy - 5_000m} of the {TwoOneSubsidy} subsidy");
            Assert.That(way.FirstPayment, Is.EqualTo(buyerPaysAll.Baseline.Payments[0].TotalOutlay), "the year-1 payment, at 4.5%");
            Assert.That(way.LaterPayment, Is.EqualTo(Way(offer, SellerOfferUse.ClosingCosts).FirstPayment), "at 6.5% once it ends");
            Assert.That(way.AnnualInterestRate, Is.EqualTo(6.5m), "the note rate does not change");
            Assert.That(way.NotUsed, Is.Zero, "all of it pays the subsidy");
        });
    }

    [Test]
    public void ForABuydown_TheRestOfALargerOffer_PaysTheClosingCosts()
    {
        var way = Way(OfferOf(7_000m), SellerOfferUse.TemporaryBuydown);
        var alone = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithClosingCosts(credits: 7_000m - TwoOneSubsidy));

        Assert.That(way.CashToClose, Is.EqualTo(alone.CashToClose!.Total), $"${7_000m - TwoOneSubsidy} of credits besides the buydown");
    }

    [Test]
    public void ForPoints_TheOfferBuysWhatItCovers_AtTheCutForEachPoint()
    {
        var way = Way(OfferOf(5_000m), SellerOfferUse.DiscountPoints);
        var alone = Service.Analyze(TexasPurchase().WithRate(5.974m).WithDiscountPoints(2.105m, 6.5m).WithClosingCosts(credits: 5_000m));

        Assert.Multiple(() =>
        {
            Assert.That(way.Points, Is.EqualTo(2.105m), "$5,000 is 2.105…% of $237,500");
            Assert.That(way.AnnualInterestRate, Is.EqualTo(5.974m), "6.5 − 2.105 × 0.25 = 5.97375");
            Assert.That(way.CashToClose, Is.EqualTo(alone.CashToClose!.Total), "the credits pay for the points");
            Assert.That(way.FirstPayment, Is.EqualTo(alone.Baseline.TotalMonthlyPayment), "at the lower rate");
            Assert.That(way.NotUsed, Is.Zero, "all of it buys points");
        });
    }

    [Test]
    public void ForPoints_TheCutForEachPoint_IsTheBuyers()
    {
        var offer = Service.Analyze(TexasPurchase().WithClosingCosts(credits: 5_000m).WithSellerOffer(rateCutPerPoint: 0.375m)).SellerOffer!;

        Assert.That(Way(offer, SellerOfferUse.DiscountPoints).AnnualInterestRate, Is.EqualTo(5.711m), "6.5 − 2.105 × 0.375 = 5.710625");
    }

    [Test]
    public void EachWay_CostsTheCashToClose_ThePayments_AndTheBalance_AndTheLeastIsBest()
    {
        var offer = OfferOf(5_000m);

        Assert.Multiple(() =>
        {
            Assert.That(offer.Options.Select(o => o.Use), Is.EqualTo(new[]
            {
                SellerOfferUse.PriceCut, SellerOfferUse.ClosingCosts, SellerOfferUse.TemporaryBuydown, SellerOfferUse.DiscountPoints,
            }), "every way, in order");
            foreach (var way in offer.Options)
                Assert.That(way.Cost, Is.EqualTo(way.CashToClose + way.Payments + way.Balance), $"{way.Use}: all three");
            Assert.That(Way(offer, offer.Best).Cost, Is.EqualTo(offer.Options.Min(o => o.Cost)), "the best costs the least");
        });
    }

    [Test]
    public void EachWay_IsCostedOverTheYearsKept()
    {
        var offer = Service.Analyze(TexasPurchase().WithClosingCosts(credits: 5_000m).WithSellerOffer(yearsKept: 30)).SellerOffer!;

        Assert.Multiple(() =>
        {
            Assert.That(offer.YearsKept, Is.EqualTo(30), "the whole loan");
            Assert.That(offer.Options.Select(o => o.Balance), Is.All.Zero, "nothing is owed at the end");
        });
    }

    [Test]
    public void BeyondTheLimit_OnlyThePriceCutUsesAllOfIt()
    {
        var offer = OfferOf(10_000m);

        Assert.Multiple(() =>
        {
            Assert.That(Way(offer, SellerOfferUse.PriceCut).NotUsed, Is.Zero, "$10,000 off the price");
            Assert.That(Way(offer, SellerOfferUse.ClosingCosts).NotUsed, Is.EqualTo(2_500m), "only the $7,500 limit pays costs");
            Assert.That(Way(offer, SellerOfferUse.TemporaryBuydown).NotUsed, Is.EqualTo(2_500m), "the buydown and the credits together");
            Assert.That(Way(offer, SellerOfferUse.DiscountPoints).Points, Is.EqualTo(3.157m), "$7,500 is 3.157…% of the loan");
            Assert.That(Way(offer, SellerOfferUse.DiscountPoints).NotUsed, Is.EqualTo(2_500m), "the points within the limit");
        });
    }

    [Test]
    public void ForPoints_OnAVaLoan_TheWholeOfferCounts_BeyondItsLimit()
    {
        // A first use with 5% down: a 1.5% funding fee financed makes the loan $241,062.50. VA's limit (4%, $10,000)
        // leaves points out, so all $11,000 buys them: 4.563 points.
        var offer = OfferOf(11_000m, A.Request.FivePercentDown().WithProgram(LoanProgramType.Va));

        Assert.That(Way(offer, SellerOfferUse.DiscountPoints).Points, Is.EqualTo(4.563m), "$11,000 is 4.5631…% of $241,062.50");
    }

    [Test]
    public void AnOfferTooSmallForAThousandthOfAPoint_BuysNoPoints()
    {
        var offer = OfferOf(2m);

        Assert.That(offer.Options.Select(o => o.Use), Has.No.Member(SellerOfferUse.DiscountPoints), "$2 is less than a thousandth of a point on $237,500");
    }

    [Test]
    public void AnOfferAsLargeAsTheLoan_CannotComeOffThePrice()
    {
        var offer = OfferOf(237_500m);

        Assert.That(offer.Options.Select(o => o.Use), Has.No.Member(SellerOfferUse.PriceCut), "it would leave nothing to borrow");
    }

    [Test]
    public void ExtraPayments_DoNotChangeIt()
    {
        var withExtras = OfferOf(5_000m, TexasPurchase().WithMonthlyExtra(300m));

        Assert.That(withExtras.Options, Is.EqualTo(OfferOf(5_000m).Options), "each way is on the standard schedule");
    }
}
