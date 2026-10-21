using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for letting the home out: the <see cref="FivePercentDown"/> purchase ($250,000, 5% down, 6.5%)
/// with Texas taxes, insurance, dues and PMI, let for $2,200 a month. Each year is checked against the loan and the
/// housing costs the calculator works out for the same request, so the rental adds only the rent, the manager and upkeep.
/// </summary>
[TestFixture]
public class RentalScenarioTests : SociableAnalysisTestBase
{
    private static AmortizationRequestBuilder Purchase() =>
        A.Request.FivePercentDown().WithHousingCosts(c => c
            .WithSchoolTax(1.0m).WithLocalTax(1.1m).WithMudTax(0.85m)
            .WithInsurance(2_400m).WithHoa(50m).WithPmi(FivePercentDown.PmiRate).WithHomeValueGrowth(3m));

    [Test]
    public void ThereIsNone_UnlessAskedFor()
    {
        Assert.That(Service.Analyze(Purchase()).Rental, Is.Null, "nothing to let");
    }

    [Test]
    public void ItCoversEachYearOfTheLoan()
    {
        var rental = Service.Analyze(Purchase().WithRental(2_200m)).Rental!;

        Assert.Multiple(() =>
        {
            Assert.That(rental.Years, Has.Count.EqualTo(30), "a 30-year loan");
            Assert.That(rental.Years.Select(y => y.Year), Is.EqualTo(Enumerable.Range(1, 30)), "from year 1");
        });
    }

    [Test]
    public void TheFirstYear_IsTheRentLessVacancyAndTheManager_LessUpkeepAndTheCostsOfOwning()
    {
        var response = Service.Analyze(Purchase().WithRental(2_200m, vacancy: 5m, management: 8m, maintenance: 1m));
        var first = response.Rental!.Years[0];
        var costs = response.Projection[0].Costs;
        var operating = costs.PropertyTax + costs.SchoolTax + costs.LocalTax + costs.MudTax + costs.HomeownersInsurance + costs.HoaDues + costs.PidAssessment;
        var interestAndPrincipal = response.Baseline.Payments.Take(12).Sum(p => p.Principal + p.Interest);

        Assert.Multiple(() =>
        {
            Assert.That(first.GrossRent, Is.EqualTo(26_400m), "12 × $2,200");
            Assert.That(first.VacancyLoss, Is.EqualTo(1_320m), "5%");
            Assert.That(first.ManagementFee, Is.EqualTo(2_006.40m), "8% of the 25,080 collected");
            Assert.That(first.Maintenance, Is.EqualTo(2_500m), "1% of the $250,000 home");
            Assert.That(first.OperatingCosts, Is.EqualTo(operating), "the year's taxes, insurance and dues, as the projection has them");
            Assert.That(first.DebtService, Is.EqualTo(interestAndPrincipal + costs.MortgageInsurance), "the year's principal and interest, and the PMI");
            Assert.That(first.NetOperatingIncome, Is.EqualTo(25_080m - 2_006.40m - 2_500m - operating), "what is collected, less what it costs to let and own");
            Assert.That(first.CashFlow, Is.EqualTo(first.NetOperatingIncome - first.DebtService), "and then the loan");
        });
    }

    [Test]
    public void TheMeasures_ComeFromTheFirstYear_AndTheCashPutIn()
    {
        var response = Service.Analyze(Purchase().WithClosingCosts().WithRental(2_200m));
        var rental = response.Rental!;
        var first = rental.Years[0];

        Assert.Multiple(() =>
        {
            Assert.That(rental.CashInvested, Is.EqualTo(response.CashToClose!.Total), "the down payment and the closing costs");
            Assert.That(rental.CapRatePercent, Is.EqualTo(Math.Round(first.NetOperatingIncome / FivePercentDown.HomePrice * 100m, 2)), "what the property earns over its price");
            Assert.That(rental.CashOnCashPercent, Is.EqualTo(Math.Round(first.CashFlow / rental.CashInvested * 100m, 2)), "the cash flow over the cash put in");
            Assert.That(rental.DebtServiceCoverage, Is.EqualTo(Math.Round(first.NetOperatingIncome / first.DebtService, 2)), "what it earns over what the loan takes");
            Assert.That(rental.GrossRentMultiplier, Is.EqualTo(Math.Round(FivePercentDown.HomePrice / first.GrossRent, 2)), "the price over a year's rent");
            Assert.That(rental.RentToPricePercent, Is.EqualTo(0.88m), "$2,200 is 0.88% of $250,000");
        });
    }

    [Test]
    public void WithoutClosingCosts_TheCashPutIn_IsTheDownPaymentAlone()
    {
        Assert.That(Service.Analyze(Purchase().WithRental(2_200m)).Rental!.CashInvested, Is.EqualTo(FivePercentDown.DownPayment), "no closing costs were given");
    }

    [Test]
    public void TheRentRises_AndSoDoTheTaxesAndInsurance_SoTheCashFlowChanges()
    {
        var years = Service.Analyze(Purchase().WithRental(2_200m, rentIncrease: 3m)).Rental!.Years;

        Assert.Multiple(() =>
        {
            Assert.That(years[1].GrossRent, Is.EqualTo(27_192m), "$2,266 a month after 3%, × 12");
            Assert.That(years[1].OperatingCosts, Is.GreaterThan(years[0].OperatingCosts), "the home is worth more, so it is taxed more");
        });
    }

    [Test]
    public void ABiggerBreakEvenRent_MeansTheCurrentRentDoesNotCarryTheHome()
    {
        var rental = Service.Analyze(Purchase().WithRental(1_500m)).Rental!;
        var atBreakEven = Service.Analyze(Purchase().WithRental(rental.BreakEvenMonthlyRent)).Rental!.Years[0];

        Assert.Multiple(() =>
        {
            Assert.That(rental.Years[0].CashFlow, Is.LessThan(0m), "$1,500 does not cover this home");
            Assert.That(rental.BreakEvenMonthlyRent, Is.GreaterThan(1_500m), "it takes more than that");
            Assert.That(Math.Abs(atBreakEven.CashFlow), Is.LessThan(5m), "at the break-even rent the first year pays for itself, within the cents of rounding");
        });
    }

    [Test]
    public void ExtraPayments_AreLeftOut()
    {
        var plain = Service.Analyze(Purchase().WithRental(2_200m)).Rental!;
        var extra = Service.Analyze(Purchase().WithMonthlyExtra(300m).WithRental(2_200m)).Rental!;

        Assert.That(extra.Years, Is.EqualTo(plain.Years), "extra principal is the owner's choice, not the property's");
    }
}
