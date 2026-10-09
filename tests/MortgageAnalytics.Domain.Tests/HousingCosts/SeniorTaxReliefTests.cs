using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

/// <summary>Over-65 / disability relief: the extra exemption and the tax ceiling ("freeze").</summary>
[TestFixture]
public class SeniorTaxReliefTests
{
    private static readonly TaxExemption TexasSchoolHomestead = new(amount: 140_000m);

    /// <summary>A $300,000 home at a 1% school rate, with optional growth capped at 10% a year.</summary>
    private static ValueBasedTax SchoolTax(SeniorTaxRelief? relief, decimal growthPercent = 0m) =>
        new(
            HousingCostCategory.SchoolTax,
            new PropertyValuation(300_000m, growthPercent, assessmentCapPercent: 10m),
            annualRatePercent: 1m,
            TexasSchoolHomestead,
            relief);

    [Test]
    public void ExtraExemption_StacksOnTheRegularHomesteadExemption()
    {
        // ($300,000 - $140,000 - $60,000) x 1% = $1,000.
        var tax = SchoolTax(new SeniorTaxRelief(startsInYear: 0, additionalExemption: 60_000m, hasTaxCeiling: false));

        Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(1_000m));
    }

    [Test]
    public void Ceiling_FreezesTheTaxWhileValuesRise()
    {
        // Value +10% a year. Without the ceiling, year 2 would be ($330,000 - $200,000) x 1% = $1,300.
        var tax = SchoolTax(new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true), growthPercent: 10m);

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(1_000m));
            Assert.That(tax.AnnualAmountInYear(1), Is.EqualTo(1_000m));
            Assert.That(tax.AnnualAmountInYear(29), Is.EqualTo(1_000m));
        });
    }

    [Test]
    public void Ceiling_IsSetInTheYearTheOwnerQualifies_NotAtPurchase()
    {
        // Values +10% a year; the owner turns 65 in year 3 (index 2).
        var tax = SchoolTax(new SeniorTaxRelief(startsInYear: 2, 60_000m, hasTaxCeiling: true), growthPercent: 10m);

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(1_600m), "($300,000 - $140,000) x 1%, before qualifying");
            Assert.That(tax.AnnualAmountInYear(1), Is.EqualTo(1_900m), "($330,000 - $140,000) x 1%, before qualifying");
            Assert.That(tax.AnnualAmountInYear(2), Is.EqualTo(1_630m), "($363,000 - $200,000) x 1%: the ceiling year");
            Assert.That(tax.AnnualAmountInYear(3), Is.EqualTo(1_630m), "frozen, though the uncapped tax would be $1,993");
        });
    }

    [Test]
    public void Ceiling_LetsTheTaxFallWhenValuesDrop()
    {
        // Value -5% a year: year 2 is ($285,000 - $200,000) x 1% = $850, below the $1,000 ceiling.
        var tax = SchoolTax(new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true), growthPercent: -5m);

        Assert.That(tax.AnnualAmountInYear(1), Is.EqualTo(850m));
    }

    [Test]
    public void WithoutACeiling_TheTaxStillRisesWithValue()
    {
        var tax = SchoolTax(new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: false), growthPercent: 10m);

        Assert.That(tax.AnnualAmountInYear(1), Is.EqualTo(1_300m));
    }

    [Test]
    public void ExemptionLargerThanTheValue_MeansNoTax()
    {
        var tax = new ValueBasedTax(
            HousingCostCategory.SchoolTax, new PropertyValuation(180_000m), 1m, TexasSchoolHomestead,
            new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true));

        Assert.That(tax.AnnualAmountInYear(0), Is.Zero);
    }

    [Test]
    public void RejectsANegativeStartYearOrExemption()
    {
        Assert.Multiple(() =>
        {
            Assert.Throws<DomainValidationException>(() => _ = new SeniorTaxRelief(-1, 0m, true));
            Assert.Throws<DomainValidationException>(() => _ = new SeniorTaxRelief(0, -1m, true));
        });
    }

    [Test]
    public void Plus_AddsToTheExemptionAmountAndKeepsThePercentage()
    {
        var stacked = new TaxExemption(amount: 3_000m, percent: 20m).Plus(10_000m);

        Assert.Multiple(() =>
        {
            Assert.That(stacked.Amount, Is.EqualTo(13_000m));
            Assert.That(stacked.Percent, Is.EqualTo(20m));
        });
    }
}
