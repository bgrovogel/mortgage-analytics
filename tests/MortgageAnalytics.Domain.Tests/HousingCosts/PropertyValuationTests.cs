using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

[TestFixture]
public class PropertyValuationTests
{
    [Test]
    public void WithoutGrowth_TheValueNeverChanges()
    {
        var valuation = new PropertyValuation(300_000m);

        Assert.Multiple(() =>
        {
            Assert.That(valuation.MarketValueInYear(0), Is.EqualTo(300_000m));
            Assert.That(valuation.MarketValueInYear(29), Is.EqualTo(300_000m));
            Assert.That(valuation.AssessedValueInYear(29), Is.EqualTo(300_000m));
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
            Assert.That(valuation.MarketValueInYear(year), Is.EqualTo(expectedMarket));
            Assert.That(valuation.AssessedValueInYear(year), Is.EqualTo(expectedAssessed));
        });
    }

    [Test]
    public void GrowthBelowTheCap_TaxableValueFollowsTheMarket()
    {
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: 3m, assessmentCapPercent: 10m);

        Assert.That(
            Enumerable.Range(0, 30).Select(valuation.AssessedValueInYear),
            Is.EqualTo(Enumerable.Range(0, 30).Select(valuation.MarketValueInYear)));
    }

    [Test]
    public void FallingMarket_TaxableValueFallsWithIt()
    {
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: -5m, assessmentCapPercent: 10m);

        Assert.That(valuation.AssessedValueInYear(1), Is.EqualTo(285_000m));
    }

    [Test]
    public void WithoutACap_TaxableValueEqualsMarketValue()
    {
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: 15m);

        Assert.That(valuation.AssessedValueInYear(1), Is.EqualTo(345_000m));
    }

    [TestCase(1, 0)]
    [TestCase(12, 0)]
    [TestCase(13, 1)]
    [TestCase(360, 29)]
    public void YearOf_GroupsPaymentsIntoLoanYears(int paymentNumber, int expectedYear)
    {
        Assert.That(PropertyValuation.YearOf(paymentNumber), Is.EqualTo(expectedYear));
    }

    [Test]
    public void RejectsInvalidInputs()
    {
        Assert.Multiple(() =>
        {
            Assert.Throws<DomainValidationException>(() => _ = new PropertyValuation(0m));
            Assert.Throws<DomainValidationException>(() => _ = new PropertyValuation(1m, annualGrowthPercent: -100m));
            Assert.Throws<DomainValidationException>(() => _ = new PropertyValuation(1m, assessmentCapPercent: -1m));
        });
    }
}
