using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

[TestFixture]
public class PropertyValuationTests
{
    [TestCase(0)]
    [TestCase(29)]
    public void WithoutGrowth_TheValueNeverChanges(int year)
    {
        var valuation = new PropertyValuation(300_000m);

        Assert.Multiple(() =>
        {
            Assert.That(valuation.MarketValueInYear(year), Is.EqualTo(300_000m), "no growth means a flat market value");
            Assert.That(valuation.AssessedValueInYear(year), Is.EqualTo(300_000m), "and a flat taxable value");
        });
    }

    [TestCase(0, 300_000.00, 300_000.00)]
    [TestCase(1, 345_000.00, 330_000.00)]
    [TestCase(2, 396_750.00, 363_000.00)]
    [TestCase(3, 456_262.50, 399_300.00)]
    public void FastGrowingMarket_TaxableValueIsCappedAtTenPercentAYear(int year, decimal expectedMarket, decimal expectedAssessed)
    {
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: 15m, assessmentCapPercent: 10m);

        Assert.Multiple(() =>
        {
            Assert.That(valuation.MarketValueInYear(year), Is.EqualTo(expectedMarket), "the market compounds at 15%");
            Assert.That(valuation.AssessedValueInYear(year), Is.EqualTo(expectedAssessed), "taxable value may rise only 10% a year");
        });
    }

    [Test]
    public void GrowthBelowTheCap_TaxableValueFollowsTheMarket()
    {
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: 3m, assessmentCapPercent: 10m);

        Assert.That(
            Enumerable.Range(0, 30).Select(valuation.AssessedValueInYear),
            Is.EqualTo(Enumerable.Range(0, 30).Select(valuation.MarketValueInYear)),
            "a cap above the growth rate never binds");
    }

    [Test]
    public void FallingMarket_TaxableValueFallsWithIt()
    {
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: -5m, assessmentCapPercent: 10m);

        Assert.That(valuation.AssessedValueInYear(1), Is.EqualTo(285_000m), "the cap limits increases only, not decreases");
    }

    [Test]
    public void WithoutACap_TaxableValueEqualsMarketValue()
    {
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: 15m);

        Assert.That(valuation.AssessedValueInYear(1), Is.EqualTo(345_000m), "a non-homestead is taxed on the full market value");
    }

    [Test]
    public void YearsBeyondTheProjection_UseTheLastProjectedYear()
    {
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: 1m);

        Assert.That(
            valuation.MarketValueInYear(PropertyValuation.ProjectedYears + 5),
            Is.EqualTo(valuation.MarketValueInYear(PropertyValuation.ProjectedYears - 1)),
            "years past the longest supported loan are clamped to the last projected year");
    }

    [Test]
    public void ExposesItsAssumptions()
    {
        var valuation = new PropertyValuation(300_000m, 4m, 10m);

        Assert.Multiple(() =>
        {
            Assert.That(valuation.AnnualGrowthPercent, Is.EqualTo(4m), "the market growth assumption");
            Assert.That(valuation.AssessmentCapPercent, Is.EqualTo(10m), "the assessment cap");
        });
    }

    [TestCase(1, 0)]
    [TestCase(12, 0)]
    [TestCase(13, 1)]
    [TestCase(360, 29)]
    public void YearOf_GroupsPaymentsIntoLoanYears(int paymentNumber, int expectedYear)
    {
        Assert.That(PropertyValuation.YearOf(paymentNumber), Is.EqualTo(expectedYear), "payments 1-12 are year 0, 13-24 year 1, and so on");
    }

    [TestCase(0, 0, null, "greater than zero", TestName = "Zero value")]
    [TestCase(1, -100, null, "greater than -100%", TestName = "Growth of -100%")]
    [TestCase(1, 0, -1, "cannot be negative", TestName = "Negative cap")]
    public void RejectsInvalidAssumptions(decimal value, decimal growth, double? cap, string guard)
    {
        DomainAssert.Rejects(
            () => new PropertyValuation(value, growth, cap is null ? null : (decimal)cap),
            guard,
            "a valuation needs a positive value, survivable growth and a non-negative cap");
    }
}
