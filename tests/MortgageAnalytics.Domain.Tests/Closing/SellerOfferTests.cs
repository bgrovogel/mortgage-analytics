using MortgageAnalytics.Domain.Closing;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Closing;

/// <summary>
/// How much of a seller's or builder's offer each use takes, within the loan's limit. The home is $415,000 with
/// $37,350 down (9%), a $377,650 loan: a conventional limit of 3%, $12,450.
/// </summary>
[TestFixture]
public class SellerOfferTests
{
    private const decimal LoanAmount = 377_650m;
    private static readonly PropertyPurchase Purchase = new(415_000m, 37_350m);
    private static readonly ConcessionLimit Conventional = ConcessionLimit.For(LoanProgram.Conventional, Purchase);
    private static readonly ConcessionLimit Va = ConcessionLimit.For(LoanProgram.Va, Purchase);

    [Test]
    public void ABuydown_TakesTheOffer_UpToItsSubsidy()
    {
        Assert.Multiple(() =>
        {
            Assert.That(SellerOffer.BuydownShare(8_000m, 9_000m, Conventional), Is.EqualTo(8_000m), "an offer short of the subsidy: the buyer pays the rest");
            Assert.That(SellerOffer.BuydownShare(10_000m, 9_000m, Conventional), Is.EqualTo(9_000m), "the rest of a larger offer is left for the closing costs");
        });
    }

    [Test]
    public void ABuydown_TakesNoMoreThanTheLimit()
    {
        Assert.That(SellerOffer.BuydownShare(20_000m, 15_000m, Conventional), Is.EqualTo(12_450m), "3% of the price, however much is offered");
    }

    [Test]
    public void Points_AreWhatTheOfferCovers_RoundedDownToAThousandthOfAPoint()
    {
        Assert.That(SellerOffer.PointsFor(8_000m, LoanAmount, Conventional), Is.EqualTo(2.118m), "$8,000 is 2.1183…% of the loan");
    }

    [Test]
    public void Points_TakeNoMoreThanTheLimit()
    {
        Assert.That(SellerOffer.PointsFor(20_000m, LoanAmount, Conventional), Is.EqualTo(3.296m), "only $12,450 of the $20,000 can pay costs: 3.2967…%");
    }

    [Test]
    public void Points_OnAVaLoan_AreOutsideTheLimit()
    {
        Assert.That(SellerOffer.PointsFor(20_000m, LoanAmount, Va), Is.EqualTo(5m), "VA lets the seller pay points besides its 4%; 5.2959… points is capped at 5");
    }

    [Test]
    public void Points_AreNoMoreThanFive()
    {
        var limit = ConcessionLimit.For(LoanProgram.Conventional, new PropertyPurchase(415_000m, 200_000m));

        Assert.That(SellerOffer.PointsFor(30_000m, 215_000m, limit), Is.EqualTo(5m), "a 9% limit lets $30,000 pay, but 13.95 points is beyond any lender's");
    }

    [Test]
    public void ThePointsRate_IsLowerByTheCutForEachPoint_ToAThousandth()
    {
        Assert.Multiple(() =>
        {
            Assert.That(SellerOffer.RateWithPoints(5.99m, 2.118m, 0.25m), Is.EqualTo(5.461m), "5.99 − 2.118 × 0.25 = 5.4605, rounded half up");
            Assert.That(SellerOffer.RateWithPoints(5.99m, 4m, 0.375m), Is.EqualTo(4.49m), "a lender that cuts ⅜ of a point for each");
        });
    }

    [Test]
    public void ThePointsRate_IsNeverBelowZero()
    {
        Assert.That(SellerOffer.RateWithPoints(1m, 5m, 0.25m), Is.Zero, "five points at a quarter each would take 1.25 off a 1% rate");
    }
}
