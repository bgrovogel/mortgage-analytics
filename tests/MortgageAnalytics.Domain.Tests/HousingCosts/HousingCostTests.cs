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

    [TestCase(HousingCostCategory.PropertyTax, 250_000, 2.1, 5_250.00, 437.50)]
    [TestCase(HousingCostCategory.MudTax, 250_000, 0.85, 2_125.00, 177.08)]
    [TestCase(HousingCostCategory.PropertyTax, 250_000, 0, 0, 0)]
    public void ValueBasedTax_ChargesTheAnnualRateOnValue_InTwelveInstallments(
        HousingCostCategory category, decimal value, decimal rate, decimal expectedAnnual, decimal expectedMonthly)
    {
        var tax = new ValueBasedTax(category, value, rate);

        Assert.Multiple(() =>
        {
            Assert.That(tax.AnnualAmount, Is.EqualTo(expectedAnnual));
            Assert.That(tax.AmountFor(Period(1)), Is.EqualTo(expectedMonthly));
            Assert.That(tax.AmountFor(Period(360)), Is.EqualTo(expectedMonthly), "taxes do not stop on their own");
        });
    }

    [Test]
    public void ValueBasedTax_RejectsNonTaxCategoriesAndNegativeInputs()
    {
        Assert.Multiple(() =>
        {
            Assert.Throws<DomainValidationException>(() => _ = new ValueBasedTax(HousingCostCategory.HoaDues, 1m, 1m));
            Assert.Throws<DomainValidationException>(() => _ = new ValueBasedTax(HousingCostCategory.PropertyTax, -1m, 1m));
            Assert.Throws<DomainValidationException>(() => _ = new ValueBasedTax(HousingCostCategory.MudTax, 1m, -1m));
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
            new ValueBasedTax(HousingCostCategory.PropertyTax, 250_000m, 2.1m),
            new ValueBasedTax(HousingCostCategory.MudTax, 250_000m, 0.85m),
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
