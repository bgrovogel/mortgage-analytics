using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Application.Tests.Validation;

[TestFixture]
public class AmortizationRequestValidatorTests : ValidatorTestBase<AmortizationRequest, AmortizationRequestValidator>
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
                .WithPmi(0.5m, PmiCancellation.BorrowerRequested));

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

    [Test]
    public void RecastFee_Negative_IsRejected()
    {
        AssertInvalid(A.Request.WithRecast(fee: -1m), "Recast.Fee", "a lender never pays the borrower to recast");
    }

    [TestCase(-1, TestName = "Negative minimum")]
    [TestCase(0, TestName = "Zero minimum: would recast after every monthly extra")]
    [TestCase(999.99, TestName = "Just under the $1,000 floor")]
    public void RecastMinimum_BelowOneThousand_IsRejected(decimal minimum)
    {
        AssertInvalid(A.Request.WithRecast(minimumLumpSum: minimum), "Recast.MinimumLumpSum", "a recast minimum this low would trigger on routine payments");
    }

    [Test]
    public void RecastMinimum_OfOneThousand_IsAccepted()
    {
        AssertNoErrorFor(A.Request.WithRecast(minimumLumpSum: 1_000m), "Recast.MinimumLumpSum", "$1,000 is the lowest minimum accepted");
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
            "'Lump sum' cannot exceed the loan amount.",
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

    [Test]
    public void BadDownPayment_DoesNotAlsoFlagTheExtraPayments()
    {
        // With no valid loan amount there is nothing to compare extra payments against.
        var request = A.Request.WithDownPayment(A.Request.Build().HomePrice).WithMonthlyExtra(200m).WithLumpSum(12, 5_000m);

        Assert.Multiple(() =>
        {
            AssertInvalid(request, "DownPayment", "the real problem is reported");
            AssertNoErrorFor(request, "ExtraPayments.MonthlyAmount", "a valid monthly extra must not be blamed for the down payment");
            AssertNoErrorFor(request, "ExtraPayments.LumpSums[0].Amount", "nor a valid lump sum");
        });
    }

    [Test]
    public void RecastTerms_WithTheShortenTermStrategy_AreRejected()
    {
        var request = A.Request.WithStrategy(ExtraPaymentStrategy.ShortenTerm).WithRecastTerms(10_000m, 250m);

        AssertErrorMessage(request, "Recast", "Recast terms are only used with the Recast strategy.", "terms that would be silently ignored are a client mistake");
    }

    // ---------------------------------------------------------------------------------------
    // Readable messages.
    // ---------------------------------------------------------------------------------------

    private static IEnumerable<TestCaseData> ReadableMessages()
    {
        yield return new TestCaseData(A.Request.WithHomePrice(0m).Build(), "HomePrice", "'Home price' must be greater than '0'.");
        yield return new TestCaseData(A.Request.WithRate(45m).Build(), "AnnualInterestRate", "'Interest rate' must be between 0 and 30. You entered 45.");
        yield return new TestCaseData(A.Request.WithTermInMonths(0).Build(), "TermInMonths", "'Term in months' must be between 1 and 600. You entered 0.");
        yield return new TestCaseData(A.Request.WithMonthlyExtra(-1m).Build(), "ExtraPayments.MonthlyAmount", "'Monthly extra payment' must be greater than or equal to '0'.");
        yield return new TestCaseData(A.Request.WithRecast(fee: -1m).Build(), "Recast.Fee", "'Recast fee' must be between 0 and 10000. You entered -1.");
    }

    [TestCaseSource(nameof(ReadableMessages))]
    public void Messages_UseReadableFieldNames(AmortizationRequest request, string path, string message)
    {
        AssertErrorMessage(request, path, message, "error messages are shown to people, so they name fields the way the form does");
    }

    // ---------------------------------------------------------------------------------------
    // Housing costs.
    // ---------------------------------------------------------------------------------------

    private static IEnumerable<TestCaseData> InvalidHousingCosts()
    {
        TestCaseData Case(string path, Func<HousingCostsRequest, HousingCostsRequest> change) =>
            new TestCaseData(change, $"HousingCosts.{path}").SetName($"{path} out of range");

        yield return Case("SchoolTaxRate", c => c with { SchoolTaxRate = 10.01m });
        yield return Case("LocalTaxRate", c => c with { LocalTaxRate = -0.01m });
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
        yield return Case("PmiCancellation", c => c with { PmiCancellation = (PmiCancellation)7 });
        yield return Case("Pid.AnnualAssessment", c => c with { Pid = new PidAssessmentRequest(-1m) });
        yield return Case("Pid.RemainingYears", c => c with { Pid = new PidAssessmentRequest(1_200m, 51) });
        yield return Case("Over65OrDisabled.QualifiesInYear", c => c with { Over65OrDisabled = new Over65OrDisabledRequest { QualifiesInYear = 0 } });
        yield return Case("Over65OrDisabled.SchoolExemption", c => c with { Over65OrDisabled = new Over65OrDisabledRequest { SchoolExemption = -1m } });
        yield return Case("Over65OrDisabled.LocalExemption", c => c with { Over65OrDisabled = new Over65OrDisabledRequest { LocalExemption = -1m } });
    }

    [TestCase(180, 16, false, TestName = "Year 16 of a 15-year loan is rejected")]
    [TestCase(180, 15, true, TestName = "Year 15 of a 15-year loan is accepted")]
    [TestCase(185, 16, true, TestName = "A 15-year-5-month loan has a 16th year")]
    public void Over65QualifyingYear_MustFallWithinTheLoanTerm(int termInMonths, int qualifiesInYear, bool valid)
    {
        var request = A.Request.WithTermInMonths(termInMonths).WithHousingCosts(c => c.AsHomestead().WithOver65(qualifiesInYear));

        if (valid)
            AssertNoErrorFor(request, "HousingCosts.Over65OrDisabled.QualifiesInYear", "the year falls within the loan");
        else
            AssertInvalid(request, "HousingCosts.Over65OrDisabled.QualifiesInYear", "relief starting after payoff would silently do nothing");
    }

    [TestCaseSource(nameof(InvalidHousingCosts))]
    public void HousingCost_OutOfRange_IsRejected(Func<HousingCostsRequest, HousingCostsRequest> change, string path)
    {
        AssertInvalid(A.Request.WithHousingCosts(c => c.With(change)), path, "each housing-cost field has a sensible range");
    }
}
