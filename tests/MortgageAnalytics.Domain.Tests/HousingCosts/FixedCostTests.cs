using MortgageAnalytics.Domain.HousingCosts;
using static MortgageAnalytics.Domain.Tests.HousingCosts.HousingCostTestData;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

/// <summary><see cref="AnnualFixedCost"/> (insurance, PID) and <see cref="MonthlyFixedCost"/> (HOA).</summary>
[TestFixture]
public class FixedCostTests
{
    [TestCase(1, 100)]
    [TestCase(120, 100)]
    [TestCase(121, 0)]
    [TestCase(360, 0)]
    public void AnnualFixedCost_WithADuration_StopsWhenItEnds(int paymentNumber, decimal expected)
    {
        var pid = new AnnualFixedCost(HousingCostCategory.PidAssessment, 1_200m, durationInYears: 10);

        Assert.That(pid.AmountFor(Period(paymentNumber)), Is.EqualTo(expected), "a 10-year PID is charged for payments 1 to 120 only");
    }

    [Test]
    public void AnnualFixedCost_WithoutADuration_NeverEnds()
    {
        var insurance = new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m);

        Assert.That(insurance.AmountFor(Period(600)), Is.EqualTo(200m), "insurance is owed for as long as the home is owned");
    }

    [Test]
    public void AnnualFixedCost_RisesEachYearByItsIncrease()
    {
        // $2,400 a year rising 5%: $200/mo in year 1, $210/mo in year 2, $2,646 in year 3.
        var insurance = new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m, annualIncreasePercent: 5m);

        Assert.Multiple(() =>
        {
            Assert.That(insurance.AmountFor(Period(12)), Is.EqualTo(200m), "year 1 is the starting premium");
            Assert.That(insurance.AmountFor(Period(13)), Is.EqualTo(210m), "year 2 is 5% higher");
            Assert.That(insurance.AnnualAmountInYear(2), Is.EqualTo(2_646m), "year 3 compounds on year 2");
        });
    }

    [Test]
    public void AnnualFixedCost_ExposesWhatItWasCreatedWith()
    {
        var pid = new AnnualFixedCost(HousingCostCategory.PidAssessment, 1_200m, 10, 2m);

        Assert.Multiple(() =>
        {
            Assert.That(pid.Category, Is.EqualTo(HousingCostCategory.PidAssessment), "the reporting category");
            Assert.That(pid.AnnualAmount, Is.EqualTo(1_200m), "the first year's amount");
            Assert.That(pid.DurationInYears, Is.EqualTo(10), "how long it lasts");
            Assert.That(pid.AnnualIncreasePercent, Is.EqualTo(2m), "how fast it rises");
        });
    }

    [Test]
    public void AnnualFixedCost_RejectsANegativeAmount()
    {
        DomainAssert.Rejects(() => new AnnualFixedCost(HousingCostCategory.PidAssessment, -1m), "cannot be negative", "a cost cannot pay the owner");
    }

    [Test]
    public void AnnualFixedCost_RejectsADurationUnderOneYear()
    {
        DomainAssert.Rejects(() => new AnnualFixedCost(HousingCostCategory.PidAssessment, 1m, 0), "at least one year", "a zero-year cost is no cost");
    }

    [Test]
    public void MonthlyFixedCost_ChargesTheSameAmountEveryMonth()
    {
        var hoa = new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m);

        Assert.That(new[] { 1, 180, 360 }.Select(n => hoa.AmountFor(Period(n))), Has.All.EqualTo(75m), "with no increase, dues never change");
    }

    [TestCase(1, 75.00)]
    [TestCase(12, 75.00)]
    [TestCase(13, 77.25)]
    [TestCase(25, 79.57)]
    public void MonthlyFixedCost_RisesOnceAYear(int paymentNumber, decimal expected)
    {
        var hoa = new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m, annualIncreasePercent: 3m);

        Assert.That(hoa.AmountFor(Period(paymentNumber)), Is.EqualTo(expected), "dues rise 3% at the start of each loan year");
    }

    [Test]
    public void MonthlyFixedCost_ExposesWhatItWasCreatedWith()
    {
        var hoa = new MonthlyFixedCost(HousingCostCategory.HoaDues, 75.005m, 3m);

        Assert.Multiple(() =>
        {
            Assert.That(hoa.Category, Is.EqualTo(HousingCostCategory.HoaDues), "the reporting category");
            Assert.That(hoa.MonthlyAmount, Is.EqualTo(75.01m), "the monthly amount is rounded to cents");
            Assert.That(hoa.AnnualIncreasePercent, Is.EqualTo(3m), "how fast it rises");
        });
    }

    [Test]
    public void MonthlyFixedCost_RejectsANegativeAmount()
    {
        DomainAssert.Rejects(() => new MonthlyFixedCost(HousingCostCategory.HoaDues, -1m), "cannot be negative", "a cost cannot pay the owner");
    }

    [TestCase(-100)]
    [TestCase(-150)]
    public void Costs_RejectAnIncreaseOfMinusOneHundredPercentOrLess(decimal increase)
    {
        Assert.Multiple(() =>
        {
            DomainAssert.Rejects(() => new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m, increase), "greater than -100%", "monthly costs cannot be wiped out or flip sign");
            DomainAssert.Rejects(() => new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 1m, null, increase), "greater than -100%", "annual costs cannot be wiped out or flip sign");
        });
    }
}
