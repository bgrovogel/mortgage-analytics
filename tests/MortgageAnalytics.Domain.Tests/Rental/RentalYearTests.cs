using MortgageAnalytics.Domain;
using MortgageAnalytics.Domain.Rental;

namespace MortgageAnalytics.Domain.Tests.Rental;

/// <summary>
/// What renting the home out earns in a year: the rent collected after vacancy, less the property manager, upkeep and the
/// taxes, insurance and dues of owning, is the net operating income; less the loan's payments, the cash flow. Every
/// expected value is worked by hand, on a home worth $400,000 let for $2,500 a month.
/// </summary>
[TestFixture]
public class RentalYearTests
{
    private static RentalAssumptions Assumptions(
        decimal rent = 2_500m, decimal vacancy = 5m, decimal management = 8m, decimal maintenance = 1m, decimal rise = 3m) =>
        new(rent, vacancy, management, maintenance, rise);

    [Test]
    public void TheFirstYear_CollectsTheRentLessVacancy_AndPaysTheManagerAndUpkeepOnWhatIsCollected()
    {
        var year = RentalYear.For(1, Assumptions(), homeValue: 400_000m, operatingCosts: 9_000m, debtService: 18_000m);

        Assert.Multiple(() =>
        {
            Assert.That(year.GrossRent, Is.EqualTo(30_000m), "12 × $2,500");
            Assert.That(year.VacancyLoss, Is.EqualTo(1_500m), "5% of 30,000");
            Assert.That(year.ManagementFee, Is.EqualTo(2_280m), "8% of the 28,500 collected");
            Assert.That(year.Maintenance, Is.EqualTo(4_000m), "1% of the $400,000 home");
            Assert.That(year.OperatingCosts, Is.EqualTo(9_000m), "taxes, insurance and dues as given");
            Assert.That(year.NetOperatingIncome, Is.EqualTo(13_220m), "28,500 less 2,280, 4,000 and 9,000");
            Assert.That(year.DebtService, Is.EqualTo(18_000m), "as given");
            Assert.That(year.CashFlow, Is.EqualTo(-4_780m), "13,220 less 18,000: the rent does not carry the loan");
        });
    }

    [Test]
    public void TheRent_RisesEachYear_ByTheGivenPercentage()
    {
        var second = RentalYear.For(2, Assumptions(), 400_000m, 9_000m, 18_000m);

        Assert.Multiple(() =>
        {
            Assert.That(second.GrossRent, Is.EqualTo(30_900m), "$2,575 a month after 3%, × 12");
            Assert.That(second.VacancyLoss, Is.EqualTo(1_545m), "5% of 30,900");
        });
    }

    [Test]
    public void ANoRise_KeepsTheRentWhereItIs() =>
        Assert.That(RentalYear.For(10, Assumptions(rise: 0m), 400_000m, 0m, 0m).GrossRent, Is.EqualTo(30_000m), "the same rent in year 10");

    [Test]
    public void WithoutVacancyOrManagement_AllTheRentIsCollected_AndKept()
    {
        var year = RentalYear.For(1, Assumptions(vacancy: 0m, management: 0m, maintenance: 0m), 400_000m, 6_000m, 20_000m);

        Assert.Multiple(() =>
        {
            Assert.That(year.NetOperatingIncome, Is.EqualTo(24_000m), "30,000 less the 6,000 of costs");
            Assert.That(year.CashFlow, Is.EqualTo(4_000m), "24,000 less 20,000 of payments");
        });
    }

    [Test]
    public void TheReturns_ComeFromTheFirstYear()
    {
        var first = RentalYear.For(1, Assumptions(), 400_000m, 9_000m, 18_000m);

        var returns = RentalReturns.From(Assumptions(), first, price: 400_000m, cashInvested: 100_000m);

        Assert.Multiple(() =>
        {
            Assert.That(returns.CapRatePercent, Is.EqualTo(3.31m), "13,220 over the $400,000 price is 3.305%");
            Assert.That(returns.CashOnCashPercent, Is.EqualTo(-4.78m), "-4,780 on the $100,000 put in");
            Assert.That(returns.DebtServiceCoverage, Is.EqualTo(0.73m), "13,220 over 18,000 of payments");
            Assert.That(returns.GrossRentMultiplier, Is.EqualTo(13.33m), "400,000 over 30,000 of rent");
            Assert.That(returns.RentToPricePercent, Is.EqualTo(0.63m), "$2,500 a month is 0.625% of the price");
        });
    }

    [Test]
    public void TheBreakEvenRent_IsWhatLeavesNoCashFlow()
    {
        var first = RentalYear.For(1, Assumptions(), 400_000m, 9_000m, 18_000m);

        var returns = RentalReturns.From(Assumptions(), first, 400_000m, 100_000m);
        var atBreakEven = RentalYear.For(1, Assumptions(rent: returns.BreakEvenMonthlyRent), 400_000m, 9_000m, 18_000m);

        Assert.Multiple(() =>
        {
            Assert.That(returns.BreakEvenMonthlyRent, Is.EqualTo(2_955.76m), "(4,000 + 9,000 + 18,000) ÷ (0.95 × 0.92) is 35,469.11 a year, ÷ 12");
            Assert.That(Math.Abs(atBreakEven.CashFlow), Is.LessThan(5m), "at that rent the year pays for itself, within the cents of rounding");
        });
    }

    [Test]
    public void WithoutALoan_ThereIsNoCoverageToSpeakOf()
    {
        var first = RentalYear.For(1, Assumptions(), 400_000m, 9_000m, debtService: 0m);

        Assert.That(RentalReturns.From(Assumptions(), first, 400_000m, 400_000m).DebtServiceCoverage, Is.Null, "nothing is owed, so nothing is covered");
    }

    [Test]
    public void WithNoCashPutIn_ThereIsNoCashOnCashReturn()
    {
        var first = RentalYear.For(1, Assumptions(), 400_000m, 9_000m, 18_000m);

        Assert.That(RentalReturns.From(Assumptions(), first, 400_000m, cashInvested: 0m).CashOnCashPercent, Is.Null, "a return on nothing is not a number");
    }

    [TestCase(0, TestName = "No rent")]
    [TestCase(1_000_000.01, TestName = "Rent past a million a month")]
    public void ARent_OutOfRange_IsRefused(double rent) =>
        Assert.That(() => RentalYear.For(1, Assumptions(rent: (decimal)rent), 400_000m, 0m, 0m), Throws.TypeOf<DomainValidationException>(), "no market has such a rent");

    [TestCase(-0.01, 0, 0, 0, TestName = "Vacancy below nothing")]
    [TestCase(50.01, 0, 0, 0, TestName = "Vacancy over half")]
    [TestCase(0, -0.01, 0, 0, TestName = "A manager paid less than nothing")]
    [TestCase(0, 25.01, 0, 0, TestName = "A manager paid over a quarter")]
    [TestCase(0, 0, -0.01, 0, TestName = "Upkeep below nothing")]
    [TestCase(0, 0, 10.01, 0, TestName = "Upkeep over 10%")]
    [TestCase(0, 0, 0, -20.01, TestName = "Rent falling more than 20% a year")]
    [TestCase(0, 0, 0, 20.01, TestName = "Rent rising more than 20% a year")]
    public void APercentage_OutOfRange_IsRefused(double vacancy, double management, double maintenance, double rise) =>
        Assert.That(
            () => RentalYear.For(1, Assumptions(vacancy: (decimal)vacancy, management: (decimal)management, maintenance: (decimal)maintenance, rise: (decimal)rise), 400_000m, 0m, 0m),
            Throws.TypeOf<DomainValidationException>(), "assumptions a market could have");
}
