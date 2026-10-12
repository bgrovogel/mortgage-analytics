using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for FHA and VA loans, first payment 1 November 2026 at 6.5% for 30 years. Expected values from
/// tools/calculator-check.
/// </summary>
[TestFixture]
public class LoanProgramScenarioTests : SociableAnalysisTestBase
{
    /// <summary>$300,000 with the FHA minimum of 3.5% down.</summary>
    private static AmortizationRequestBuilder Fha(bool finance = true) =>
        A.Request.WithHomePrice(300_000m).WithDownPayment(10_500m).WithRate(6.5m)
            .WithProgram(LoanProgramType.Fha, financeUpfrontFee: finance);

    /// <summary>$400,000 with nothing down.</summary>
    private static AmortizationRequestBuilder Va(VaFundingFeeType use = VaFundingFeeType.FirstUse) =>
        A.Request.WithHomePrice(400_000m).WithDownPayment(0m).WithRate(6.5m).WithProgram(LoanProgramType.Va, use);

    [Test]
    public void AnFhaLoan_BorrowsTheUpfrontMip_AndPaysAnnualMipForTheWholeTerm()
    {
        var response = Service.Analyze(Fha());

        Assert.Multiple(() =>
        {
            Assert.That(response.Program!.Type, Is.EqualTo(LoanProgramType.Fha), "an FHA loan");
            Assert.That(response.Program.UpfrontFee, Is.EqualTo(5_066.25m), "1.75% of the $289,500 base loan");
            Assert.That(response.Program.LoanAmount, Is.EqualTo(294_566.25m), "added to the loan");
            Assert.That(response.Program.AnnualMipPercent, Is.EqualTo(0.55m), "96.5% LTV, 30 years");
            Assert.That(response.Purchase.LoanAmount, Is.EqualTo(289_500m), "the purchase's own loan is the base loan");
            Assert.That(response.Baseline.MonthlyPayment, Is.EqualTo(1_861.86m), "principal and interest on the whole $294,566.25");
            Assert.That(response.Baseline.MonthlyHousingCosts.MortgageInsurance, Is.EqualTo(134.33m), "year 1's MIP");
            Assert.That(response.Baseline.TotalHousingCosts.MortgageInsurance, Is.EqualTo(31_790.40m), "MIP over all 360 payments");
            Assert.That(response.Baseline.MortgageInsuranceEndDate, Is.EqualTo(response.Baseline.PayoffDate), "it lasts the whole term");
            Assert.That(response.Projection[0].LoanBalance, Is.EqualTo(294_566.25m), "the equity starts net of the financed fee");
        });
    }

    [Test]
    public void PayingTheLoanOffEarly_EndsFhaMip_AndCountsAsSavings()
    {
        var savings = Service.Analyze(Fha().WithMonthlyExtra(300m)).Savings;

        Assert.That(savings.MortgageInsuranceSaved, Is.Positive, "MIP stops with the last payment, so paying off sooner saves it");
    }

    [Test]
    public void AnUpfrontFeePaidInCash_IsInTheCashToClose_NotTheLoan()
    {
        var response = Service.Analyze(Fha(finance: false).WithClosingCosts(loanCosts: 0m, otherFees: 0m, prepaidInterestDays: 0, escrowMonths: 0));

        Assert.Multiple(() =>
        {
            Assert.That(response.Program!.LoanAmount, Is.EqualTo(289_500m), "only the base loan is borrowed");
            Assert.That(response.CashToClose!.UpfrontMortgageFee, Is.EqualTo(5_066.25m), "the fee is paid at closing");
            Assert.That(response.CashToClose.Total, Is.EqualTo(10_500m + 5_066.25m), "with the down payment (no taxes or insurance here)");
        });
    }

    [Test]
    public void AVaLoan_BorrowsTheFundingFee_AndHasNoMortgageInsurance()
    {
        var response = Service.Analyze(Va().WithHousingCosts(c => c.WithInsurance(2_400m)));

        Assert.Multiple(() =>
        {
            Assert.That(response.Program!.Type, Is.EqualTo(LoanProgramType.Va), "a VA loan");
            Assert.That(response.Program.UpfrontFee, Is.EqualTo(8_600m), "2.15% for a first use with nothing down");
            Assert.That(response.Program.LoanAmount, Is.EqualTo(408_600m), "added to the loan");
            Assert.That(response.Baseline.MonthlyPayment, Is.EqualTo(2_582.63m), "on the whole $408,600");
            Assert.That(response.Baseline.TotalHousingCosts.MortgageInsurance, Is.Zero, "no PMI and no MIP, even with nothing down");
            Assert.That(response.Purchase.MortgageInsuranceRequired, Is.False, "PMI is a conventional loan's");
        });
    }

    [Test]
    public void AVaLoanUsedBefore_PaysTheHigherFee()
    {
        Assert.That(Service.Analyze(Va(VaFundingFeeType.SubsequentUse)).Program!.UpfrontFee, Is.EqualTo(13_200m), "3.3% with less than 5% down");
    }

    [Test]
    public void AConventionalLoan_HasNoProgramSummary()
    {
        Assert.That(Service.Analyze(A.Request).Program, Is.Null, "nothing to say beyond the loan itself");
    }

    [Test]
    public void TheUpfrontFee_IsFinancedUnlessSaidOtherwise()
    {
        var request = A.Request.WithHomePrice(300_000m).WithDownPayment(10_500m).Build() with { Program = new LoanProgramRequest { Type = LoanProgramType.Fha } };

        Assert.That(Service.Analyze(request).Program!.LoanAmount, Is.EqualTo(294_566.25m), "most borrowers add it to the loan, so that is the default");
    }

    [Test]
    public void FhasLoanSizeLimit_IsTheOneForTheYearTheLoanCloses()
    {
        // First payment January 2026, so the loan closes in December 2025, under 2025's $806,500 limit.
        var request = A.Request.WithHomePrice(900_000m).WithDownPayment(90_000m).WithFirstPaymentDate(new DateOnly(2026, 1, 1))
            .WithProgram(LoanProgramType.Fha);

        Assert.That(Service.Analyze(request).Program!.AnnualMipPercent, Is.EqualTo(0.70m), "$810,000 is above 2025's limit, though within 2026's");
    }
}
