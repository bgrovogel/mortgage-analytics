using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for renting against buying: the <see cref="FivePercentDown"/> purchase ($250,000, 5% down, 6.5%)
/// with Texas taxes, insurance, dues and PMI, against renting a similar home. Each year is checked against the loan the
/// calculator works out for the same request, so the comparison adds only the renter's side and the upkeep.
/// </summary>
[TestFixture]
public class RentOrBuyScenarioTests : SociableAnalysisTestBase
{
    private static AmortizationRequestBuilder TexasPurchase() =>
        A.Request.FivePercentDown().WithHousingCosts(c => c
            .WithSchoolTax(1.0m).WithLocalTax(1.1m).WithMudTax(0.85m)
            .WithInsurance(2_400m).WithHoa(50m).WithPmi(FivePercentDown.PmiRate).WithHomeValueGrowth(3m));

    [Test]
    public void ThereIsNone_UnlessAskedFor()
    {
        Assert.That(Service.Analyze(TexasPurchase()).RentOrBuy, Is.Null, "nothing to weigh the home against");
    }

    [Test]
    public void OwningCosts_TheLoansPayments_AndUpkeep()
    {
        var response = Service.Analyze(TexasPurchase().WithClosingCosts().WithRentOrBuy(1_800m, maintenance: 1m));
        var payments = response.Baseline.Payments.Take(12).Sum(p => p.TotalOutlay);

        Assert.Multiple(() =>
        {
            Assert.That(response.RentOrBuy!.Years[0].OwnershipCost, Is.EqualTo(payments + 12 * 208.33m),
                "the year's payments with their housing costs, and 1% of $250,000 a year in upkeep");
            Assert.That(response.RentOrBuy.Years[0].Rent, Is.EqualTo(21_600m), "12 × $1,800");
            Assert.That(response.RentOrBuy.Years[1].Rent, Is.EqualTo(22_356m), "3.5% more in year 2: $1,863 a month");
        });
    }

    [Test]
    public void TheRenter_StartsWithTheCashToClose()
    {
        var withCosts = Service.Analyze(TexasPurchase().WithClosingCosts().WithRentOrBuy(1_800m));
        var without = Service.Analyze(TexasPurchase().WithRentOrBuy(1_800m));

        Assert.Multiple(() =>
        {
            Assert.That(withCosts.RentOrBuy!.CashToClose, Is.EqualTo(withCosts.CashToClose!.Total), "the down payment and the closing costs");
            Assert.That(without.RentOrBuy!.CashToClose, Is.EqualTo(FivePercentDown.DownPayment), "the down payment alone without closing costs");
        });
    }

    [Test]
    public void TheBuyersEquity_IsTheHomeLessWhatIsOwed_AndSellingCosts()
    {
        var response = Service.Analyze(TexasPurchase().WithRentOrBuy(1_800m, selling: 6m));
        var fifth = response.RentOrBuy!.Years[4];
        var value = response.Projection[5].MarketValue;
        var owed = response.Baseline.Payments[59].RemainingBalance;

        Assert.Multiple(() =>
        {
            Assert.That(fifth.HomeEquity, Is.EqualTo(value - owed - Math.Round(value * 0.06m, 2)), "sold after five years, less 6%");
            Assert.That(fifth.BuyerNetWorth, Is.EqualTo(fifth.HomeEquity + fifth.BuyerInvestments), "the equity and the buyer's investments");
            Assert.That(fifth.Advantage, Is.EqualTo(fifth.BuyerNetWorth - fifth.RenterNetWorth), "buying against renting");
        });
    }

    [Test]
    public void ExtraPayments_AreLeftOut()
    {
        var plain = Service.Analyze(TexasPurchase().WithRentOrBuy(1_800m)).RentOrBuy!;
        var extra = Service.Analyze(TexasPurchase().WithMonthlyExtra(300m).WithRentOrBuy(1_800m)).RentOrBuy!;

        Assert.That(extra.Years, Is.EqualTo(plain.Years), "extra principal is an investment choice, like the renter's");
    }

    [Test]
    public void CheapRent_KeepsRentingAhead_AndDearRent_MakesBuyingWinSooner()
    {
        var cheap = Service.Analyze(TexasPurchase().WithClosingCosts().WithRentOrBuy(1_000m)).RentOrBuy!;
        var dear = Service.Analyze(TexasPurchase().WithClosingCosts().WithRentOrBuy(3_000m)).RentOrBuy!;

        Assert.Multiple(() =>
        {
            Assert.That(cheap.Years[4].Advantage, Is.LessThan(0m), "renting at $1,000 is ahead after five years");
            Assert.That(dear.BreakEvenYear, Is.Not.Null.And.LessThanOrEqualTo(3), "renting at $3,000, buying wins within three years");
            Assert.That(dear.Years.Select(y => y.Year), Is.EqualTo(Enumerable.Range(1, 30)), "every year of the 30-year loan");
        });
    }
}
