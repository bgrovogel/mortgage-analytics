using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

/// <summary>
/// FHA and VA loans: the upfront fee (FHA's upfront MIP, VA's funding fee), the loan with it financed, and FHA's
/// annual MIP from HUD Mortgagee Letter 2023-05. Expected values from tools/calculator-check.
/// </summary>
[TestFixture]
public class GovernmentLoanTests : AmortizationTestBase
{
    /// <summary>$300,000 with the FHA minimum of 3.5% down: a $289,500 base loan.</summary>
    private static readonly PropertyPurchase FhaMinimumDown = new(300_000m, 10_500m);

    [Test]
    public void Fha_AddsTheUpfrontMipToTheLoan_AndChargesAnnualMipForTheWholeTerm()
    {
        var fha = GovernmentLoan.Fha(FhaMinimumDown, termInMonths: 360, closingYear: 2026, financeUpfrontFee: true);

        Assert.Multiple(() =>
        {
            Assert.That(fha.Program, Is.EqualTo(LoanProgram.Fha), "an FHA loan");
            Assert.That(fha.UpfrontFee, Is.EqualTo(5_066.25m), "1.75% of the $289,500 base loan");
            Assert.That(fha.LoanAmount, Is.EqualTo(294_566.25m), "financed, so it is borrowed with the loan");
            Assert.That(fha.AnnualMipPercent, Is.EqualTo(0.55m), "over 95% LTV on a loan over 15 years");
            Assert.That(fha.MipPayments, Is.EqualTo(360), "above 90% LTV, MIP lasts the whole term");
        });
    }

    [Test]
    public void AnUpfrontFeePaidInCash_IsNotBorrowed()
    {
        var fha = GovernmentLoan.Fha(FhaMinimumDown, 360, 2026, financeUpfrontFee: false);

        Assert.That(fha.LoanAmount, Is.EqualTo(289_500m), "the loan is the base loan; the fee is paid at closing");
    }

    // HUD ML 2023-05: terms over 15 years, then 15 years or less; at or below the conforming limit, then above it.
    [TestCase(300_000, 10_500, 360, 0.55, 360, TestName = "Over15Years_Above95PercentLtv")]
    [TestCase(300_000, 15_000, 360, 0.50, 360, TestName = "Over15Years_Exactly95PercentLtv")]
    [TestCase(300_000, 30_000, 360, 0.50, 132, TestName = "Over15Years_90PercentLtv")]
    [TestCase(1_000_000, 35_000, 360, 0.75, 360, TestName = "Over15Years_AboveTheLimit_Above95PercentLtv")]
    [TestCase(1_000_000, 100_000, 360, 0.70, 132, TestName = "Over15Years_AboveTheLimit_90PercentLtv")]
    [TestCase(300_000, 30_000, 180, 0.15, 132, TestName = "Term15Years_90PercentLtv")]
    [TestCase(300_000, 10_500, 180, 0.40, 180, TestName = "Term15Years_Above90PercentLtv")]
    [TestCase(1_200_000, 264_000, 180, 0.15, 132, TestName = "Term15Years_AboveTheLimit_78PercentLtv")]
    [TestCase(1_200_000, 180_000, 180, 0.40, 132, TestName = "Term15Years_AboveTheLimit_85PercentLtv")]
    [TestCase(1_000_000, 100_000, 180, 0.40, 132, TestName = "Term15Years_AboveTheLimit_Exactly90PercentLtv")]
    [TestCase(1_200_000, 60_000, 180, 0.65, 180, TestName = "Term15Years_AboveTheLimit_95PercentLtv")]
    public void FhaAnnualMip_FollowsHudsTable(decimal price, decimal down, int term, decimal rate, int payments)
    {
        var fha = GovernmentLoan.Fha(new PropertyPurchase(price, down), term, 2026, financeUpfrontFee: true);

        Assert.Multiple(() =>
        {
            Assert.That(fha.AnnualMipPercent, Is.EqualTo(rate), "the annual rate for this term, LTV and loan size");
            Assert.That(fha.MipPayments, Is.EqualTo(payments), "and how long it is charged");
        });
    }

    [TestCase(2025, 0.70, TestName = "Year2025_LimitIs806500")]
    [TestCase(2026, 0.50, TestName = "Year2026_LimitIs832750")]
    public void TheLoanSizeLimit_IsTheConformingLimitForTheYearTheLoanCloses(int closingYear, decimal rate)
    {
        var fha = GovernmentLoan.Fha(new PropertyPurchase(900_000m, 90_000m), 360, closingYear, financeUpfrontFee: true);

        Assert.That(fha.AnnualMipPercent, Is.EqualTo(rate), "the same $810,000 loan, a different year's limit");
    }

    [Test]
    public void ALoanExactlyAtTheLimit_IsWithinIt()
    {
        var fha = GovernmentLoan.Fha(new PropertyPurchase(925_277.78m, 92_527.78m), 360, 2026, financeUpfrontFee: true);

        Assert.That(fha.AnnualMipPercent, Is.EqualTo(0.50m), "an $832,750 base loan is at, not above, 2026's limit");
    }

    [Test]
    public void AVaFundingFeePaidInCash_IsNotBorrowed()
    {
        var va = GovernmentLoan.Va(new PropertyPurchase(400_000m, 0m), VaFundingFeeUse.FirstUse, financeUpfrontFee: false);

        Assert.Multiple(() =>
        {
            Assert.That(va.UpfrontFee, Is.EqualTo(8_600m), "the fee is the same");
            Assert.That(va.LoanAmount, Is.EqualTo(400_000m), "but only the base loan is borrowed");
        });
    }

    [TestCase(2022, 726_200, TestName = "Before2023")]
    [TestCase(2024, 766_550, TestName = "Year2024")]
    [TestCase(2026, 832_750, TestName = "Year2026")]
    [TestCase(2030, 832_750, TestName = "ALaterYear")]
    public void ConformingLimits_ByYear(int year, decimal limit)
    {
        Assert.That(ConformingLoanLimit.For(year), Is.EqualTo(limit), "FHFA's baseline one-unit limit");
    }

    [Test]
    public void Fha_NeedsAtLeast3Point5PercentDown()
    {
        DomainAssert.Rejects(() => GovernmentLoan.Fha(new PropertyPurchase(300_000m, 10_499.99m), 360, 2026, true), "3.5%",
            "FHA's minimum down payment");
    }

    [TestCase(0, VaFundingFeeUse.FirstUse, 2.15, 8_600, TestName = "Va_NothingDown_FirstUse")]
    [TestCase(0, VaFundingFeeUse.SubsequentUse, 3.3, 13_200, TestName = "Va_NothingDown_UsedBefore")]
    [TestCase(20_000, VaFundingFeeUse.SubsequentUse, 1.5, 5_700, TestName = "Va_FivePercentDown")]
    [TestCase(40_000, VaFundingFeeUse.FirstUse, 1.25, 4_500, TestName = "Va_TenPercentDown")]
    [TestCase(0, VaFundingFeeUse.Exempt, 0, 0, TestName = "Va_Exempt")]
    public void VaFundingFee_DependsOnTheDownPaymentAndUse(decimal down, VaFundingFeeUse use, decimal percent, decimal fee)
    {
        var va = GovernmentLoan.Va(new PropertyPurchase(400_000m, down), use, financeUpfrontFee: true);

        Assert.Multiple(() =>
        {
            Assert.That(va.UpfrontFeePercent, Is.EqualTo(percent), "the funding fee rate");
            Assert.That(va.UpfrontFee, Is.EqualTo(fee), "on the base loan");
            Assert.That(va.LoanAmount, Is.EqualTo(400_000m - down + fee), "financed with it");
            Assert.That(va.AnnualMipPercent, Is.Zero, "VA loans have no mortgage insurance");
        });
    }

    [Test]
    public void FhaMip_IsATwelfthOfTheRate_OnEachYearsAverageScheduledBalance()
    {
        var fha = GovernmentLoan.Fha(FhaMinimumDown, 360, 2026, financeUpfrontFee: true);
        var original = StandardSchedule(new LoanTerms(fha.LoanAmount, 6.5m, 360, new DateOnly(2026, 11, 1)));
        var mip = new FhaMortgageInsurance(fha, original);

        decimal Charge(int payment) => mip.AmountFor(new CostPeriod(payment, 0m, 0m));
        Assert.Multiple(() =>
        {
            Assert.That(mip.Category, Is.EqualTo(HousingCostCategory.MortgageInsurance), "reported as the loan's mortgage insurance");
            Assert.That(Charge(1), Is.EqualTo(134.33m), "year 1: 0.55% of the average balance over its 12 payments, ÷ 12");
            Assert.That(Charge(12), Is.EqualTo(134.33m), "the same all year");
            Assert.That(Charge(13), Is.EqualTo(132.77m), "year 2's balance is lower, so is its MIP");
            Assert.That(Charge(121), Is.EqualTo(113.15m), "year 11");
            Assert.That(Charge(360), Is.EqualTo(5.41m), "charged to the last payment");
        });
    }

    [Test]
    public void FhaMip_StopsAfter11Years_At90PercentOrLess()
    {
        var fha = GovernmentLoan.Fha(new PropertyPurchase(300_000m, 30_000m), 360, 2026, financeUpfrontFee: true);
        var mip = new FhaMortgageInsurance(fha, StandardSchedule(new LoanTerms(fha.LoanAmount, 6.5m, 360, new DateOnly(2026, 11, 1))));

        Assert.Multiple(() =>
        {
            Assert.That(mip.AmountFor(new CostPeriod(132, 0m, 0m)), Is.Positive, "payment 132 is the last of 11 years");
            Assert.That(mip.AmountFor(new CostPeriod(133, 0m, 0m)), Is.Zero, "and then it ends");
        });
    }
}
