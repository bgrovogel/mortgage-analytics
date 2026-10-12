namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for tax rates that change, and an over-65 ceiling brought from a former home. The home is the
/// reference $250,000 purchase, with no growth, so each year's tax is the rate on the same value.
/// </summary>
[TestFixture]
public class TaxRateChangeScenarioTests : SociableAnalysisTestBase
{
    [Test]
    public void ARateChange_ChangesEachYearsTax_FromItsYear()
    {
        var projection = Service.Analyze(A.Request.WithHousingCosts(c => c.WithPropertyTax(2m).WithRateChange(3, propertyTaxRate: 1.5m))).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[1].Costs.PropertyTax, Is.EqualTo(5_000m), "year 2 at 2% of $250,000");
            Assert.That(projection[2].Costs.PropertyTax, Is.EqualTo(3_750m), "year 3 at the new 1.5%");
            Assert.That(projection[29].Costs.PropertyTax, Is.EqualTo(3_750m), "and every year after");
        });
    }

    [Test]
    public void SeparateTaxes_ChangeOnTheirOwn()
    {
        var projection = Service.Analyze(A.Request.WithHousingCosts(c => c.WithSchoolTax(1m).WithLocalTax(1.1m)
            .WithRateChange(2, schoolTaxRate: 0.9m).WithRateChange(4, localTaxRate: 1.2m))).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[1].Costs.SchoolTax, Is.EqualTo(2_250m), "school at 0.9% from year 2");
            Assert.That(projection[1].Costs.LocalTax, Is.EqualTo(2_750m), "county/city unchanged in year 2");
            Assert.That(projection[3].Costs.LocalTax, Is.EqualTo(3_000m), "and at 1.2% from year 4");
            Assert.That(projection[3].Costs.SchoolTax, Is.EqualTo(2_250m), "while school keeps its own change");
        });
    }

    [Test]
    public void ATransferredCeiling_KeepsTheShareOfSchoolTaxPaidBefore()
    {
        // $250,000 less $140,000 and $60,000 of exemptions: $50,000 at 1% is $500, and 40% of it is the ceiling.
        var projection = Service.Analyze(A.Request.WithHousingCosts(c => c.WithSchoolTax(1m).AsHomestead().WithHomeValueGrowth(5m)
            .WithOver65(transferredCeilingPercent: 40m))).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[0].Costs.SchoolTax, Is.EqualTo(200m), "40% of the $500 the new home would owe");
            Assert.That(projection[9].Costs.SchoolTax, Is.EqualTo(200m), "frozen there as the value grows");
        });
    }
}
