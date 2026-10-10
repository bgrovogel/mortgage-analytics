using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;
using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Application.Tests.Validation;

[TestFixture]
public class AmortizationRequestValidatorTests : ValidatorTestBase
{
    // ---------------------------------------------------------------------------------------
    // Valid requests.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void StandardRequest_IsValid()
    {
        AssertValid(A.Request, "the reference loan is a normal, valid request");
    }

    [Test]
    public void FullyPopulatedRequest_IsValid()
    {
        var request = A.Request
            .FivePercentDown()
            .WithRecast(10_000m, 250m)
            .WithMonthlyExtra(250m, startingPaymentNumber: 6)
            .WithAnnualExtra(2_000m)
            .WithLumpSum(24, 10_000m)
            .WithHousingCosts(c => c
                .WithSchoolTax(1.0m).WithLocalTax(1.1m).WithMudTax(0.85m)
                .AsHomestead(localExemptionPercent: 20m)
                .WithOver65(qualifiesInYear: 5, localExemption: 5_000m, localTaxCeiling: true)
                .WithHomeValueGrowth(3m).WithInsurance(2_400m, 5m).WithHoa(75m, 3m)
                .WithPid(1_200m, 20)
                .WithPmi(0.5m, MortgageInsuranceCancellation.BorrowerRequested));

        AssertValid(request, "every optional section filled with sensible values must pass");
    }

    [Test]
    public void ZeroDownPayment_IsAllowed()
    {
        AssertNoErrorFor(A.Request.WithDownPayment(0m), nameof(AmortizationRequest.DownPayment), "100% financing is a real product");
    }

    // ---------------------------------------------------------------------------------------
    // Purchase and loan.
    // ---------------------------------------------------------------------------------------

    [TestCase(0)]
    [TestCase(-5)]
    [TestCase(375_000.001)]
    public void HomePrice_NonPositiveOrSubCent_IsRejected(decimal price)
    {
        AssertInvalid(A.Request.WithHomePrice(price), nameof(AmortizationRequest.HomePrice), "the price must be a positive amount in whole cents");
    }

    [TestCase(-1, TestName = "Negative down payment")]
    [TestCase(250_000, TestName = "Down payment equal to the price")]
    [TestCase(300_000, TestName = "Down payment above the price")]
    public void DownPayment_NegativeOrCoveringThePrice_IsRejected(decimal down)
    {
        AssertInvalid(A.Request.WithDownPayment(down), nameof(AmortizationRequest.DownPayment), "there must be something left to borrow");
    }

    [Test]
    public void LoanAmountAboveTheMaximum_IsReportedOnTheDownPayment()
    {
        var request = A.Request.WithHomePrice(200_000_000m).WithDownPayment(0m);

        AssertInvalid(request, nameof(AmortizationRequest.DownPayment), "the down payment is what brings the loan under the maximum");
    }

    [TestCase(-0.1)]
    [TestCase(30.01)]
    public void InterestRate_OutOfRange_IsRejected(decimal rate)
    {
        AssertInvalid(A.Request.WithRate(rate), nameof(AmortizationRequest.AnnualInterestRate), "rates are limited to 0-30%");
    }

    [TestCase(0)]
    [TestCase(-12)]
    [TestCase(601)]
    public void Term_OutOfRange_IsRejected(int months)
    {
        AssertInvalid(A.Request.WithTermInMonths(months), nameof(AmortizationRequest.TermInMonths), "terms are limited to 1-600 months");
    }

    [Test]
    public void Strategy_UndefinedEnumValue_IsRejected()
    {
        AssertInvalid(A.Request.WithStrategy((ExtraPaymentStrategy)99), nameof(AmortizationRequest.Strategy), "only defined strategies are accepted");
    }

    [Test]
    public void FirstPaymentDate_TooFarInTheFuture_IsRejected()
    {
        AssertInvalid(A.Request.WithFirstPaymentDate(DateOnly.MaxValue), nameof(AmortizationRequest.FirstPaymentDate), "600 months past this date would overflow DateOnly");
    }

    // ---------------------------------------------------------------------------------------
    // Recast terms.
    // ---------------------------------------------------------------------------------------

    [TestCase("Recast.MinimumLumpSum")]
    [TestCase("Recast.Fee")]
    public void RecastTerms_NegativeValues_AreRejected(string path)
    {
        AssertInvalid(A.Request.WithRecast(minimumLumpSum: -1m, fee: -1m), path, "lender terms cannot be negative");
    }

    // ---------------------------------------------------------------------------------------
    // Extra payments.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void NegativeMonthlyExtra_IsRejected()
    {
        AssertInvalid(A.Request.WithMonthlyExtra(-1m), "ExtraPayments.MonthlyAmount", "a negative extra would add to the debt");
    }

    [Test]
    public void ExtraPaymentLargerThanTheLoan_IsRejectedWithAClearMessage()
    {
        // The reference loan is $200,000.
        AssertErrorMessage(
            A.Request.WithLumpSum(12, 200_000.01m),
            "ExtraPayments.LumpSums[0].Amount",
            "'Amount' cannot exceed the loan amount.",
            "an extra larger than the whole loan is always a mistake");
    }

    [Test]
    public void LumpSumOfZero_IsRejected()
    {
        AssertInvalid(A.Request.WithLumpSum(12, 0m), "ExtraPayments.LumpSums[0].Amount", "a lump sum must be a real payment");
    }

    [TestCase(0)]
    [TestCase(361)]
    public void LumpSumOutsideTheTerm_IsRejected(int paymentNumber)
    {
        AssertInvalid(A.Request.WithLumpSum(paymentNumber, 1_000m), "ExtraPayments.LumpSums[0].PaymentNumber", "a lump sum must land on a real payment");
    }

    [Test]
    public void AnnualExtraStartingAfterTheTerm_IsRejected()
    {
        var request = A.Request.WithTermInMonths(120).WithAnnualExtra(1_000m, firstPaymentNumber: 121);

        AssertInvalid(request, "ExtraPayments.Annual.FirstPaymentNumber", "the first annual extra must fall within the term");
    }

    [Test]
    public void TooManyLumpSums_IsRejected()
    {
        var lumpSums = Enumerable.Range(1, AmortizationRequestValidator.MaxLumpSums + 1)
            .Select(n => new LumpSumPaymentRequest(n, 1m))
            .ToList();

        AssertInvalid(A.Request.WithLumpSums(lumpSums), "ExtraPayments.LumpSums", "the number of lump sums is capped to bound the work per request");
    }

    // ---------------------------------------------------------------------------------------
    // Housing costs.
    // ---------------------------------------------------------------------------------------

    private static IEnumerable<TestCaseData> InvalidHousingCosts()
    {
        TestCaseData Case(string path, Func<HousingCostsRequest, HousingCostsRequest> change) =>
            new TestCaseData(change, $"HousingCosts.{path}").SetName($"{path} out of range");

        yield return Case("SchoolTaxRate", c => c with { SchoolTaxRate = 10.01m });
        yield return Case("PropertyTaxRate", c => c with { PropertyTaxRate = -0.01m });
        yield return Case("MudTaxRate", c => c with { MudTaxRate = 5.01m });
        yield return Case("PmiRate", c => c with { PmiRate = 5.01m });
        yield return Case("AnnualHomeownersInsurance", c => c with { AnnualHomeownersInsurance = -1m });
        yield return Case("MonthlyHoaDues", c => c with { MonthlyHoaDues = 75.001m });
        yield return Case("SchoolHomesteadExemption", c => c with { SchoolHomesteadExemption = -1m });
        yield return Case("LocalHomesteadExemptionPercent", c => c with { LocalHomesteadExemptionPercent = 100.01m });
        yield return Case("HomesteadAssessmentCap", c => c with { HomesteadAssessmentCap = -1m });
        yield return Case("HomeValueGrowthRate", c => c with { HomeValueGrowthRate = 25.01m });
        yield return Case("InsuranceIncreaseRate", c => c with { InsuranceIncreaseRate = 50.01m });
        yield return Case("HoaIncreaseRate", c => c with { HoaIncreaseRate = -20.01m });
        yield return Case("PmiCancellation", c => c with { PmiCancellation = (MortgageInsuranceCancellation)7 });
        yield return Case("Pid.AnnualAssessment", c => c with { Pid = new PidAssessmentRequest(-1m) });
        yield return Case("Pid.RemainingYears", c => c with { Pid = new PidAssessmentRequest(1_200m, 51) });
        yield return Case("Over65OrDisabled.QualifiesInYear", c => c with { Over65OrDisabled = new Over65OrDisabledRequest { QualifiesInYear = 0 } });
        yield return Case("Over65OrDisabled.SchoolExemption", c => c with { Over65OrDisabled = new Over65OrDisabledRequest { SchoolExemption = -1m } });
        yield return Case("Over65OrDisabled.LocalExemption", c => c with { Over65OrDisabled = new Over65OrDisabledRequest { LocalExemption = -1m } });
    }

    [TestCaseSource(nameof(InvalidHousingCosts))]
    public void HousingCost_OutOfRange_IsRejected(Func<HousingCostsRequest, HousingCostsRequest> change, string path)
    {
        AssertInvalid(A.Request.WithHousingCosts(c => c.With(change)), path, "each housing-cost field has a sensible range");
    }
}
