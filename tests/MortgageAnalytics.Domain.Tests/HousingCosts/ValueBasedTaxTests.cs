using MortgageAnalytics.Domain.HousingCosts;
using static MortgageAnalytics.Domain.Tests.HousingCosts.HousingCostTestData;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

[TestFixture]
public class ValueBasedTaxTests
{
    [TestCase(HousingCostCategory.PropertyTax, 250_000, 2.1, 5_250.00, 437.50)]
    [TestCase(HousingCostCategory.MudTax, 250_000, 0.85, 2_125.00, 177.08)]
    [TestCase(HousingCostCategory.SchoolTax, 250_000, 0, 0, 0)]
    public void ChargesTheAnnualRateOnValue_InTwelveInstallments(
        HousingCostCategory category, decimal value, decimal rate, decimal expectedAnnual, decimal expectedMonthly)
    {
        var tax = new ValueBasedTax(category, Flat(value), rate);

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(expectedAnnual), "the annual bill is rate x value");
            Assert.That(tax.AmountFor(Period(1)), Is.EqualTo(expectedMonthly), "a regular installment is a twelfth of the bill");
            Assert.That(tax.AmountFor(Period(349)), Is.EqualTo(expectedMonthly), "a flat value means a flat tax, year after year");
        });
    }

    [Test]
    public void TwelveInstallmentsAddUpToTheAnnualBillExactly()
    {
        // $5,000 / 12 = $416.666...: eleven installments of $416.67 and a twelfth of $416.63.
        var tax = new ValueBasedTax(HousingCostCategory.PropertyTax, Flat(250_000m), 2m);

        var installments = Enumerable.Range(1, 12).Select(n => tax.AmountFor(Period(n))).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(installments.Take(11), Has.All.EqualTo(416.67m), "the first eleven installments are the rounded twelfth");
            Assert.That(installments[11], Is.EqualTo(416.63m), "the twelfth absorbs the rounding");
            Assert.That(installments.Sum(), Is.EqualTo(5_000m), "a year's installments must equal the bill to the cent");
        });
    }

    [Test]
    public void TexasSchoolHomesteadExemption_TaxesOnlyTheValueAbove140k()
    {
        // $300,000 home, 1% school rate: $160,000 taxable -> $1,600 a year -> $133.33 a month.
        var tax = new ValueBasedTax(HousingCostCategory.SchoolTax, Flat(300_000m), 1m, TexasSchoolHomestead);

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(1_600m), "($300,000 - $140,000) x 1%");
            Assert.That(tax.AmountFor(Period(1)), Is.EqualTo(133.33m), "$1,600 / 12, rounded");
        });
    }

    [Test]
    public void IsRecalculatedEachYearFromTheCappedAssessedValue()
    {
        // Market +15% a year, taxable value capped at +10%: year 2 is taxed on $330,000, not $345,000.
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: 15m, assessmentCapPercent: 10m);
        var tax = new ValueBasedTax(HousingCostCategory.SchoolTax, valuation, 1m, TexasSchoolHomestead);

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(1_600m), "year 1: (300,000 - 140,000) x 1%");
            Assert.That(tax.AmountFor(Period(13)), Is.EqualTo(158.33m), "year 2: (330,000 - 140,000) x 1% / 12");
            Assert.That(tax.AnnualAmountInYear(2), Is.EqualTo(2_230m), "year 3: (363,000 - 140,000) x 1%");
        });
    }

    [Test]
    public void ExposesItsRateAndExemption()
    {
        var tax = new ValueBasedTax(HousingCostCategory.SchoolTax, Flat(1m), 1.25m, TexasSchoolHomestead);

        Assert.Multiple(() =>
        {
            Assert.That(tax.Category, Is.EqualTo(HousingCostCategory.SchoolTax), "the category it reports under");
            Assert.That(tax.AnnualRatePercent, Is.EqualTo(1.25m), "the rate it was created with");
            Assert.That(tax.Exemption, Is.EqualTo(TexasSchoolHomestead), "the exemption it was created with");
            Assert.That(tax.SeniorRelief, Is.Null, "no senior relief unless given");
        });
    }

    [Test]
    public void RejectsNonTaxCategories()
    {
        DomainAssert.Rejects(() => new ValueBasedTax(HousingCostCategory.HoaDues, Flat(1m), 1m), "school, property or MUD", "dues are not a tax on value");
    }

    [Test]
    public void RejectsANegativeRate()
    {
        DomainAssert.Rejects(() => new ValueBasedTax(HousingCostCategory.MudTax, Flat(1m), -1m), "cannot be negative", "a negative rate would pay the owner");
    }
}
