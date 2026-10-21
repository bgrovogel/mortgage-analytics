using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for selling: the <see cref="FivePercentDown"/> purchase ($250,000, 5% down, 6.5%) with its home
/// rising 3% a year. Each year is checked against the loan and the projection the calculator works out for the same
/// request, so the sale adds only the selling costs and the tax on the gain.
/// </summary>
[TestFixture]
public class SaleScenarioTests : SociableAnalysisTestBase
{
    private static AmortizationRequestBuilder Purchase() =>
        A.Request.FivePercentDown().WithHousingCosts(c => c.WithHomeValueGrowth(3m));

    [Test]
    public void ThereIsNone_UnlessAskedFor()
    {
        Assert.That(Service.Analyze(Purchase()).Sale, Is.Null, "nothing to sell");
    }

    [Test]
    public void ItCoversEachYearOfTheLoan()
    {
        var sale = Service.Analyze(Purchase().WithSale()).Sale!;

        Assert.Multiple(() =>
        {
            Assert.That(sale.Years, Has.Count.EqualTo(30), "a 30-year loan");
            Assert.That(sale.Years.Select(y => y.Year), Is.EqualTo(Enumerable.Range(1, 30)), "from year 1");
            Assert.That(sale.SellingCostPercent, Is.EqualTo(6m), "the default");
            Assert.That(sale.GainsTaxRatePercent, Is.EqualTo(15m), "the default");
        });
    }

    [Test]
    public void TheProceeds_AreTheValueLessWhatIsOwed_TheCostsAndTheTax()
    {
        var response = Service.Analyze(Purchase().WithSale(selling: 6m));
        var fifth = response.Sale!.Years[4];
        var value = response.Projection[5].MarketValue;
        var owed = response.Baseline.Payments[59].RemainingBalance;
        var costs = Math.Round(value * 0.06m, 2);

        Assert.Multiple(() =>
        {
            Assert.That(fifth.HomeValue, Is.EqualTo(value), "the home's value after five years, as the projection says");
            Assert.That(fifth.LoanBalance, Is.EqualTo(owed), "what the schedule says is owed after 60 payments");
            Assert.That(fifth.SellingCosts, Is.EqualTo(costs), "6% of the value");
            Assert.That(fifth.Gain, Is.EqualTo(value - costs - FivePercentDown.HomePrice), "the sale less its costs, over the $250,000 paid");
            Assert.That(fifth.TaxOnGain, Is.EqualTo(0m), "a gain this size is under the exclusion");
            Assert.That(fifth.NetProceeds, Is.EqualTo(value - owed - costs), "what is left");
        });
    }

    [Test]
    public void ExtraPayments_LowerWhatIsOwed_SoTheSellerKeepsMore()
    {
        var plain = Service.Analyze(Purchase().WithSale()).Sale!.Years[4];
        var response = Service.Analyze(Purchase().WithMonthlyExtra(300m).WithSale());
        var extra = response.Sale!.Years[4];

        Assert.Multiple(() =>
        {
            Assert.That(extra.LoanBalance, Is.EqualTo(response.Accelerated.Payments[59].RemainingBalance), "what the plan owes after 60 payments");
            Assert.That(extra.LoanBalance, Is.LessThan(plain.LoanBalance), "paying extra owes less");
            Assert.That(extra.NetProceeds, Is.GreaterThan(plain.NetProceeds), "and keeps more");
        });
    }

    [Test]
    public void OnceTheLoanIsPaidOff_NothingIsOwed()
    {
        var sale = Service.Analyze(Purchase().WithMonthlyExtra(3_000m).WithSale()).Sale!;

        Assert.That(sale.Years[^1].LoanBalance, Is.EqualTo(0m), "paid off long before year 30");
    }

    [Test]
    public void ALivedInHome_ShieldsTheFirst250000OfGain_AndACouplesHalfAMillion()
    {
        var single = Service.Analyze(Purchase().WithSale(filingStatus: TaxFilingStatus.Single)).Sale!;
        var couple = Service.Analyze(Purchase().WithSale(filingStatus: TaxFilingStatus.MarriedFilingJointly)).Sale!;

        Assert.Multiple(() =>
        {
            Assert.That(single.ExclusionPerSale, Is.EqualTo(250_000m), "a single filer");
            Assert.That(couple.ExclusionPerSale, Is.EqualTo(500_000m), "a couple filing jointly");
        });
    }

    [Test]
    public void AnInvestmentProperty_HasNoExclusion_SoTheWholeGainIsTaxed()
    {
        var sale = Service.Analyze(Purchase().WithOccupancy(OccupancyType.InvestmentProperty).WithSale(gainsTaxRate: 20m)).Sale!;
        var thirtieth = sale.Years[^1];

        Assert.Multiple(() =>
        {
            Assert.That(sale.ExclusionPerSale, Is.EqualTo(0m), "a rental gets none");
            Assert.That(thirtieth.TaxFreeGain, Is.EqualTo(0m), "so none of the gain is sheltered");
            Assert.That(thirtieth.TaxOnGain, Is.EqualTo(Math.Round(thirtieth.Gain * 0.20m, 2)), "all of it is taxed at 20%");
        });
    }

    [Test]
    public void TheFirstYear_HasNoExclusion_EvenForAHomeLivedIn()
    {
        var first = Service.Analyze(Purchase().WithSale()).Sale!.Years[0];

        Assert.Multiple(() =>
        {
            Assert.That(first.TaxFreeGain, Is.EqualTo(0m), "two years of ownership are needed");
            Assert.That(first.TaxOnGain, Is.EqualTo(Math.Round(Math.Max(first.Gain, 0m) * 0.15m, 2)), "so a gain is taxed whole");
        });
    }
}
