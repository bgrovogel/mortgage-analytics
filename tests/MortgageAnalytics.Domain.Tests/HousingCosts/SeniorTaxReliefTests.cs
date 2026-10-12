using MortgageAnalytics.Domain.HousingCosts;
using static MortgageAnalytics.Domain.Tests.HousingCosts.HousingCostTestData;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

/// <summary>Over-65 / disability relief: the extra exemption and the tax ceiling ("freeze").</summary>
[TestFixture]
public class SeniorTaxReliefTests
{
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
        var tax = SchoolTax(new SeniorTaxRelief(startsInYear: 0, additionalExemption: 60_000m, hasTaxCeiling: false));

        Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(1_000m), "($300,000 - $140,000 - $60,000) x 1%");
    }

    [TestCase(0)]
    [TestCase(1)]
    [TestCase(29)]
    public void Ceiling_FreezesTheTaxWhileValuesRise(int year)
    {
        var tax = SchoolTax(new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true), growthPercent: 10m);

        Assert.That(tax.AnnualAmountInYear(year), Is.EqualTo(1_000m), "values rise 10% a year, but the frozen tax never does");
    }

    [TestCase(0, 1_600, TestName = "Year 1, before qualifying: ($300,000 - $140,000) x 1%")]
    [TestCase(1, 1_900, TestName = "Year 2, before qualifying: ($330,000 - $140,000) x 1%")]
    [TestCase(2, 1_630, TestName = "Year 3, the ceiling year: ($363,000 - $200,000) x 1%")]
    [TestCase(3, 1_630, TestName = "Year 4, frozen though the uncapped tax would be $1,993")]
    public void Ceiling_IsSetInTheYearTheOwnerQualifies_NotAtPurchase(int year, decimal expected)
    {
        var tax = SchoolTax(new SeniorTaxRelief(startsInYear: 2, 60_000m, hasTaxCeiling: true), growthPercent: 10m);

        Assert.That(tax.AnnualAmountInYear(year), Is.EqualTo(expected), "the freeze starts in the qualifying year");
    }

    [Test]
    public void Ceiling_LetsTheTaxFallWhenValuesDrop()
    {
        var tax = SchoolTax(new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true), growthPercent: -5m);

        Assert.That(tax.AnnualAmountInYear(1), Is.EqualTo(850m), "($285,000 - $200,000) x 1%, below the $1,000 ceiling");
    }

    [Test]
    public void Ceiling_IsTheQualifyingYearsBill_AtThatYearsRate()
    {
        // $100,000 taxable after $200,000 of exemptions. The rate is 1.2% when the owner qualifies (year 3), then 1.5%,
        // then 0.5%: the bill is capped at $1,200 while the rate is higher, and falls with it when it is lower.
        var tax = new ValueBasedTax(
            HousingCostCategory.SchoolTax, Flat(300_000m), 1m, TexasSchoolHomestead, new SeniorTaxRelief(2, 60_000m, hasTaxCeiling: true),
            new Dictionary<int, decimal> { [2] = 1.2m, [4] = 1.5m, [6] = 0.5m });

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(2), Is.EqualTo(1_200m), "the qualifying year's bill, at its own 1.2%");
            Assert.That(tax.AnnualAmountInYear(4), Is.EqualTo(1_200m), "a higher rate later cannot raise it above the ceiling");
            Assert.That(tax.AnnualAmountInYear(6), Is.EqualTo(500m), "a lower rate brings it below");
        });
    }

    [Test]
    public void ATransferredCeiling_KeepsTheShareOfTaxPaidAtTheFormerHome()
    {
        // Paying 25% of the school tax at the former home: the new home's ceiling is 25% of its first year's bill.
        var tax = SchoolTax(new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true, transferredCeilingFraction: 0.25m), growthPercent: 10m);

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(250m), "25% of the $1,000 the new home would owe");
            Assert.That(tax.AnnualAmountInYear(10), Is.EqualTo(250m), "and frozen there as values rise");
        });
    }

    [TestCase(0, TestName = "A transferred share of nothing")]
    [TestCase(1.01, TestName = "A transferred share above the whole tax")]
    public void RejectsATransferredShareOutsideZeroToOne(decimal fraction)
    {
        DomainAssert.Rejects(() => new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true, transferredCeilingFraction: fraction), "share",
            "the share of tax paid under a ceiling is more than none and at most all of it");
    }

    [Test]
    public void AcceptsATransferredShareOfTheWholeTax()
    {
        DomainAssert.Accepts(() => new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true, transferredCeilingFraction: 1m),
            "an owner whose old ceiling had not yet held the tax down paid all of it");
    }

    [Test]
    public void RejectsATransferredShareWithoutACeiling()
    {
        DomainAssert.Rejects(() => new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: false, transferredCeilingFraction: 0.5m), "ceiling",
            "only a ceiling can be transferred");
    }

    [Test]
    public void WithoutACeiling_TheTaxStillRisesWithValue()
    {
        var tax = SchoolTax(new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: false), growthPercent: 10m);

        Assert.That(tax.AnnualAmountInYear(1), Is.EqualTo(1_300m), "($330,000 - $200,000) x 1%: no freeze without a ceiling");
    }

    [Test]
    public void ExemptionLargerThanTheValue_MeansNoTax()
    {
        var tax = new ValueBasedTax(
            HousingCostCategory.SchoolTax, Flat(180_000m), 1m, TexasSchoolHomestead,
            new SeniorTaxRelief(0, 60_000m, hasTaxCeiling: true));

        Assert.That(tax.AnnualAmountInYear(0), Is.Zero, "$200,000 of exemptions on a $180,000 home leaves nothing to tax");
    }

    [TestCase(0, false)]
    [TestCase(2, false)]
    [TestCase(3, true)]
    public void AppliesIn_OnlyFromTheQualifyingYear(int year, bool expected)
    {
        var relief = new SeniorTaxRelief(startsInYear: 3, 60_000m, hasTaxCeiling: true);

        Assert.That(relief.AppliesIn(year), Is.EqualTo(expected), "relief starts in loan year 3 (0-based) and continues");
    }

    [Test]
    public void ExposesWhatItWasCreatedWith()
    {
        var relief = new SeniorTaxRelief(2, 60_000m, hasTaxCeiling: true);

        Assert.Multiple(() =>
        {
            Assert.That(relief.StartsInYear, Is.EqualTo(2), "the qualifying year");
            Assert.That(relief.AdditionalExemption, Is.EqualTo(60_000m), "the extra exemption");
            Assert.That(relief.HasTaxCeiling, Is.True, "whether a ceiling applies");
        });
    }

    [Test]
    public void RejectsANegativeStartYear()
    {
        DomainAssert.Rejects(() => new SeniorTaxRelief(-1, 0m, true), "qualifying year", "relief cannot start before the loan");
    }

    [Test]
    public void RejectsANegativeExemption()
    {
        DomainAssert.Rejects(() => new SeniorTaxRelief(0, -1m, true), "additional exemption", "an exemption cannot add value");
    }

    [Test]
    public void TaxableValue_IsTheAssessedValueMinusThisUnitsExemptions_FromTheQualifyingYear()
    {
        var tax = SchoolTax(new SeniorTaxRelief(startsInYear: 2, additionalExemption: 60_000m, hasTaxCeiling: true));

        Assert.Multiple(() =>
        {
            Assert.That(tax.TaxableValueInYear(0), Is.EqualTo(160_000m), "$300,000 - $140,000 homestead");
            Assert.That(tax.TaxableValueInYear(2), Is.EqualTo(100_000m), "minus another $60,000 once the owner qualifies");
        });
    }
}
