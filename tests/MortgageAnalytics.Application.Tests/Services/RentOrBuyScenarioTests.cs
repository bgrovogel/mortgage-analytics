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
    public void ThereIsNoTaxSaving_UnlessAsked_AndTheComparisonSaysSo()
    {
        var response = Service.Analyze(TexasPurchase().WithRentOrBuy(1_800m)).RentOrBuy!;

        Assert.Multiple(() =>
        {
            Assert.That(response.CountsTaxSavings, Is.False, "the interest deduction is left out");
            Assert.That(response.Years.Select(y => y.TaxSaved), Is.All.EqualTo(0m), "so no year has a saving");
        });
    }

    [Test]
    public void TheTaxOwningSaves_IsTheDeductionAboveTheStandardOne_AtTheTaxRate()
    {
        // A single filer at 24%, with $8,000 of other state taxes: owning adds the interest and the property tax up to the limit.
        var response = Service.Analyze(TexasPurchase().WithRentOrBuy(1_800m).WithOwnerTaxes(TaxFilingStatus.Single, 24m, 8_000m));
        var interest = response.Baseline.Payments.Take(12).Sum(p => p.Interest);
        var propertyTax = response.Projection[0].Costs.SchoolTax + response.Projection[0].Costs.LocalTax + response.Projection[0].Costs.MudTax + response.Projection[0].Costs.PropertyTax;
        // Renting: the $8,000 is under the $16,100 standard deduction. Owning: 8,000 + the property tax + the interest.
        var owning = 8_000m + propertyTax + interest;
        var expected = Math.Round((owning - 16_100m) * 0.24m, 2);

        Assert.Multiple(() =>
        {
            Assert.That(response.RentOrBuy!.CountsTaxSavings, Is.True, "the comparison counts it");
            Assert.That(response.RentOrBuy.Years[0].TaxSaved, Is.EqualTo(expected).Within(0.01m), "the first year's deduction above the standard one, at 24%");
            Assert.That(response.RentOrBuy.Years[0].TaxSaved, Is.GreaterThan(0m), "owning this home does save tax");
        });
    }

    [Test]
    public void CountingTheTaxSaving_ImprovesBuying_ThroughTheRentersSideHere_ButNotWhatOwningCosts()
    {
        var without = Service.Analyze(TexasPurchase().WithClosingCosts().WithRentOrBuy(1_800m)).RentOrBuy!;
        var with = Service.Analyze(TexasPurchase().WithClosingCosts().WithRentOrBuy(1_800m).WithOwnerTaxes(TaxFilingStatus.Single, 24m, 8_000m)).RentOrBuy!;

        Assert.Multiple(() =>
        {
            Assert.That(with.Years[4].BuyerNetWorth, Is.GreaterThanOrEqualTo(without.Years[4].BuyerNetWorth), "the buyer is never worse off for a saving");
            Assert.That(with.Years[4].RenterNetWorth, Is.LessThan(without.Years[4].RenterNetWorth),
                "owning feels cheaper, so what the renter has left over to invest each month shrinks: whichever costs less invests the difference");
            Assert.That(with.Years[4].Advantage, Is.GreaterThan(without.Years[4].Advantage), "buying comes out better");
            Assert.That(with.Years[0].OwnershipCost, Is.EqualTo(without.Years[0].OwnershipCost), "the bills are the same; the saving is on the tax return");
        });
    }

    [Test]
    public void ThereAreNoValueScenarios_UnlessAskedFor()
    {
        Assert.That(Service.Analyze(TexasPurchase().WithRentOrBuy(1_800m)).RentOrBuy!.Scenarios, Is.Empty, "the plan's own value is the only one");
    }

    [Test]
    public void AValueScenario_AtThePlansOwnRate_IsThePlansOwnComparison()
    {
        var response = Service.Analyze(TexasPurchase().WithClosingCosts().WithRentOrBuy(1_800m, valueChanges: [3m])).RentOrBuy!;

        Assert.Multiple(() =>
        {
            Assert.That(response.Scenarios.Select(s => s.YearlyChangePercent), Is.EqualTo(new[] { 3m }), "each with its rate");
            Assert.That(response.Scenarios[0].Years, Is.EqualTo(response.Years), "the home worth what the plan says gives the plan's years");
            Assert.That(response.Scenarios[0].BreakEvenYear, Is.EqualTo(response.BreakEvenYear), "and its break-even year");
        });
    }

    [Test]
    public void AValueScenario_ChangesTheHomesWorth_AndItsUpkeep_ButNotWhatIsOwed()
    {
        var response = Service.Analyze(TexasPurchase().WithRentOrBuy(1_800m, selling: 6m, valueChanges: [0m]));
        var flat = response.RentOrBuy!.Scenarios[0].Years;
        var owed = response.Baseline.Payments[59].RemainingBalance;
        var payments = response.Baseline.Payments.Skip(12).Take(12).Sum(p => p.TotalOutlay);

        Assert.Multiple(() =>
        {
            Assert.That(flat[4].HomeEquity, Is.EqualTo(250_000m - owed - 15_000m), "a flat market sells at the price paid, less what is owed and 6%");
            Assert.That(flat[1].OwnershipCost, Is.EqualTo(payments + 12 * 208.33m), "upkeep stays 1% of $250,000 a year, not of a value that has risen");
            Assert.That(response.RentOrBuy!.Years[1].OwnershipCost, Is.GreaterThan(flat[1].OwnershipCost), "the plan's rising value costs more to keep up");
            Assert.That(flat.Select(y => y.Rent), Is.EqualTo(response.RentOrBuy.Years.Select(y => y.Rent)), "the rent does not depend on the price");
        });
    }

    [Test]
    public void TheDearerTheHomeBecomes_TheSoonerBuyingPaysOff()
    {
        var response = Service.Analyze(TexasPurchase().WithClosingCosts().WithRentOrBuy(1_800m, valueChanges: [-3m, 0m, 6m])).RentOrBuy!;
        var (falling, flat, rising) = (response.Scenarios[0], response.Scenarios[1], response.Scenarios[2]);

        Assert.Multiple(() =>
        {
            Assert.That(falling.Years[9].Advantage, Is.LessThan(flat.Years[9].Advantage), "falling prices leave buying worse off than flat ones");
            Assert.That(flat.Years[9].Advantage, Is.LessThan(rising.Years[9].Advantage), "and flat ones worse than rising ones");
            Assert.That(falling.Years.Select(y => y.Year), Is.EqualTo(Enumerable.Range(1, 30)), "a year for each year of the loan, as the plan has");
        });
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
