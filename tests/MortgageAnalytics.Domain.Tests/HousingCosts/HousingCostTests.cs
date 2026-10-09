using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

[TestFixture]
public class HousingCostTests
{
    private static CostPeriod Period(int number, decimal openingBalance = 200_000m) => new(number, openingBalance);

    // ---------------------------------------------------------------------------------------
    // Value-based taxes (property tax, MUD).
    // ---------------------------------------------------------------------------------------

    private static PropertyValuation Flat(decimal value) => new(value);

    [TestCase(HousingCostCategory.PropertyTax, 250_000, 2.1, 5_250.00, 437.50)]
    [TestCase(HousingCostCategory.MudTax, 250_000, 0.85, 2_125.00, 177.08)]
    [TestCase(HousingCostCategory.SchoolTax, 250_000, 0, 0, 0)]
    public void ValueBasedTax_ChargesTheAnnualRateOnValue_InTwelveInstallments(
        HousingCostCategory category, decimal value, decimal rate, decimal expectedAnnual, decimal expectedMonthly)
    {
        var tax = new ValueBasedTax(category, Flat(value), rate);

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(expectedAnnual));
            Assert.That(tax.AmountFor(Period(1)), Is.EqualTo(expectedMonthly));
            Assert.That(tax.AmountFor(Period(349)), Is.EqualTo(expectedMonthly), "a flat value means a flat tax");
        });
    }

    [Test]
    public void ValueBasedTax_TexasSchoolHomesteadExemption_TaxesOnlyTheValueAbove140k()
    {
        // $300,000 home, 1% school rate: $160,000 taxable -> $1,600 a year -> $133.33 a month.
        var tax = new ValueBasedTax(HousingCostCategory.SchoolTax, Flat(300_000m), 1m, new TaxExemption(amount: 140_000m));

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(1_600m));
            Assert.That(tax.AmountFor(Period(1)), Is.EqualTo(133.33m));
        });
    }

    [Test]
    public void ValueBasedTax_IsRecalculatedEachYearFromTheCappedAssessedValue()
    {
        // Market +15% a year, taxable value capped at +10%: year 2 is taxed on $330,000, not $345,000.
        var valuation = new PropertyValuation(300_000m, annualGrowthPercent: 15m, assessmentCapPercent: 10m);
        var tax = new ValueBasedTax(HousingCostCategory.SchoolTax, valuation, 1m, new TaxExemption(amount: 140_000m));

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmountInYear(0), Is.EqualTo(1_600m), "year 1: (300,000 - 140,000) x 1%");
            Assert.That(tax.AmountFor(Period(13)), Is.EqualTo(158.33m), "year 2: (330,000 - 140,000) x 1%");
            Assert.That(tax.AnnualAmountInYear(2), Is.EqualTo(2_230m), "year 3: (363,000 - 140,000) x 1%");
        });
    }

    [Test]
    public void ValueBasedTax_TwelveInstallmentsAddUpToTheAnnualBillExactly()
    {
        // $5,000 / 12 = $416.666...: eleven installments of $416.67 and a twelfth of $416.63.
        var tax = new ValueBasedTax(HousingCostCategory.PropertyTax, Flat(250_000m), 2m);

        var installments = Enumerable.Range(1, 12).Select(n => tax.AmountFor(Period(n))).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(installments.Take(11), Has.All.EqualTo(416.67m));
            Assert.That(installments[11], Is.EqualTo(416.63m));
            Assert.That(installments.Sum(), Is.EqualTo(5_000m));
        });
    }

    [Test]
    public void ValueBasedTax_RejectsNonTaxCategoriesAndNegativeRates()
    {
        Assert.Multiple(() =>
        {
            Assert.Throws<DomainValidationException>(() => _ = new ValueBasedTax(HousingCostCategory.HoaDues, Flat(1m), 1m));
            Assert.Throws<DomainValidationException>(() => _ = new ValueBasedTax(HousingCostCategory.MudTax, Flat(1m), -1m));
        });
    }

    // ---------------------------------------------------------------------------------------
    // Exemptions.
    // ---------------------------------------------------------------------------------------

    [TestCase(300_000, 140_000, 0, 160_000, TestName = "Fixed amount: Texas school homestead")]
    [TestCase(300_000, 0, 20, 240_000, TestName = "Percentage: 20% local option")]
    [TestCase(300_000, 10_000, 20, 230_000, TestName = "Both: percentage first, then the amount")]
    [TestCase(100_000, 140_000, 0, 0, TestName = "Exemption larger than the value: nothing to tax")]
    public void TaxExemption_ReducesTheTaxableValue(decimal assessed, decimal amount, decimal percent, decimal expected)
    {
        Assert.That(new TaxExemption(amount, percent).TaxableValue(assessed), Is.EqualTo(expected));
    }

    [Test]
    public void TaxExemption_RejectsNegativeAmountsAndPercentagesOutsideZeroToHundred()
    {
        Assert.Multiple(() =>
        {
            Assert.Throws<DomainValidationException>(() => _ = new TaxExemption(amount: -1m));
            Assert.Throws<DomainValidationException>(() => _ = new TaxExemption(percent: 101m));
            Assert.That(TaxExemption.None.TaxableValue(250_000m), Is.EqualTo(250_000m));
        });
    }

    // ---------------------------------------------------------------------------------------
    // Fixed costs (PID, insurance, HOA).
    // ---------------------------------------------------------------------------------------

    [TestCase(1, 100)]
    [TestCase(120, 100)]
    [TestCase(121, 0)]
    [TestCase(360, 0)]
    public void AnnualFixedCost_WithADuration_StopsWhenItEnds(int paymentNumber, decimal expected)
    {
        var pid = new AnnualFixedCost(HousingCostCategory.PidAssessment, 1_200m, durationInYears: 10);

        Assert.That(pid.AmountFor(Period(paymentNumber)), Is.EqualTo(expected));
    }

    [Test]
    public void AnnualFixedCost_RisesEachYearByItsIncrease()
    {
        // $2,400 a year rising 5%: $200/mo in year 1, $210/mo in year 2, $2,646 in year 3.
        var insurance = new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m, annualIncreasePercent: 5m);

        Assert.Multiple(() =>
        {
            Assert.That(insurance.AmountFor(Period(12)), Is.EqualTo(200m));
            Assert.That(insurance.AmountFor(Period(13)), Is.EqualTo(210m));
            Assert.That(insurance.AnnualAmountInYear(2), Is.EqualTo(2_646m));
        });
    }

    [Test]
    public void AnnualFixedCost_WithoutADuration_NeverEnds()
    {
        var insurance = new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m);

        Assert.That(insurance.AmountFor(Period(600)), Is.EqualTo(200m));
    }

    [Test]
    public void AnnualFixedCost_RejectsANegativeAmountOrAZeroDuration()
    {
        Assert.Multiple(() =>
        {
            Assert.Throws<DomainValidationException>(() => _ = new AnnualFixedCost(HousingCostCategory.PidAssessment, -1m));
            Assert.Throws<DomainValidationException>(() => _ = new AnnualFixedCost(HousingCostCategory.PidAssessment, 1m, 0));
        });
    }

    [Test]
    public void MonthlyFixedCost_ChargesTheSameAmountEveryMonth()
    {
        var hoa = new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m);

        Assert.That(new[] { 1, 180, 360 }.Select(n => hoa.AmountFor(Period(n))), Has.All.EqualTo(75m));
    }

    [TestCase(1, 75.00)]
    [TestCase(12, 75.00)]
    [TestCase(13, 77.25)]
    [TestCase(25, 79.57)]
    public void MonthlyFixedCost_RisesOnceAYear(int paymentNumber, decimal expected)
    {
        var hoa = new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m, annualIncreasePercent: 3m);

        Assert.That(hoa.AmountFor(Period(paymentNumber)), Is.EqualTo(expected));
    }

    [Test]
    public void Costs_RejectAnIncreaseOfMinusOneHundredPercentOrLess()
    {
        Assert.Multiple(() =>
        {
            Assert.Throws<DomainValidationException>(() => _ = new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m, -100m));
            Assert.Throws<DomainValidationException>(() => _ = new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 1m, null, -150m));
        });
    }

    // ---------------------------------------------------------------------------------------
    // PMI.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void MortgageInsurance_IsChargedOnTheOriginalLoanAmount()
    {
        // 0.5% of $237,500 / 12 = $98.958... which rounds to $98.96.
        var pmi = new MortgageInsurance(0.5m, new PropertyPurchase(250_000m, 12_500m));

        Assert.Multiple(() =>
        {
            Assert.That(pmi.IsRequired, Is.True);
            Assert.That(pmi.MonthlyPremium, Is.EqualTo(98.96m));
            Assert.That(pmi.AmountFor(Period(1, 237_500m)), Is.EqualTo(98.96m));
        });
    }

    [TestCase(50_000, false, TestName = "Exactly 20% down: not required")]
    [TestCase(49_999.99, true, TestName = "Just under 20% down: required")]
    public void MortgageInsurance_IsRequiredOnlyWithLessThanTwentyPercentDown(decimal downPayment, bool expected)
    {
        var purchase = new PropertyPurchase(250_000m, downPayment);

        var pmi = new MortgageInsurance(0.5m, purchase);

        Assert.Multiple(() =>
        {
            Assert.That(pmi.IsRequired, Is.EqualTo(expected));
            Assert.That(pmi.AmountFor(Period(1, purchase.LoanAmount)) > 0, Is.EqualTo(expected));
        });
    }

    [TestCase(MortgageInsuranceCancellation.Automatic, 195_000.01, 98.96)]
    [TestCase(MortgageInsuranceCancellation.Automatic, 195_000.00, 0)]
    [TestCase(MortgageInsuranceCancellation.BorrowerRequested, 200_000.01, 98.96)]
    [TestCase(MortgageInsuranceCancellation.BorrowerRequested, 200_000.00, 0)]
    public void MortgageInsurance_StopsAtTheCancellationLoanToValue(
        MortgageInsuranceCancellation cancellation, decimal openingBalance, decimal expected)
    {
        // 78% of $250,000 is $195,000; 80% is $200,000.
        var pmi = new MortgageInsurance(0.5m, new PropertyPurchase(250_000m, 12_500m), cancellation);

        Assert.That(pmi.AmountFor(Period(100, openingBalance)), Is.EqualTo(expected));
    }

    [Test]
    public void MortgageInsurance_RejectsANegativeRate()
    {
        Assert.Throws<DomainValidationException>(() => _ = new MortgageInsurance(-0.1m, new PropertyPurchase(250_000m, 0m)));
    }

    // ---------------------------------------------------------------------------------------
    // Breakdowns.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Breakdown_GroupsAmountsByCategory_AndTotalsThem()
    {
        IHousingCost[] costs =
        [
            new ValueBasedTax(HousingCostCategory.PropertyTax, Flat(250_000m), 2.1m),
            new ValueBasedTax(HousingCostCategory.MudTax, Flat(250_000m), 0.85m),
            new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m),
        ];

        var breakdown = HousingCostBreakdown.For(costs, Period(1));

        Assert.Multiple(() =>
        {
            Assert.That(breakdown[HousingCostCategory.PropertyTax], Is.EqualTo(437.50m));
            Assert.That(breakdown[HousingCostCategory.MudTax], Is.EqualTo(177.08m));
            Assert.That(breakdown[HousingCostCategory.HoaDues], Is.EqualTo(75m));
            Assert.That(breakdown[HousingCostCategory.MortgageInsurance], Is.Zero, "absent categories read as zero");
            Assert.That(breakdown.Total, Is.EqualTo(689.58m));
        });
    }

    [Test]
    public void Breakdown_Sum_AddsCategoryByCategory()
    {
        var month = HousingCostBreakdown.For([new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m)], Period(1));

        var year = HousingCostBreakdown.Sum(Enumerable.Repeat(month, 12));

        Assert.Multiple(() =>
        {
            Assert.That(year[HousingCostCategory.HoaDues], Is.EqualTo(900m));
            Assert.That(year.Total, Is.EqualTo(900m));
            Assert.That(HousingCostBreakdown.Empty.Total, Is.Zero);
        });
    }
}
