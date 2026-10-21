using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;
using MortgageAnalytics.Testing.Builders;

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
                .WithPmi(0.5m, PmiCancellation.BorrowerRequested))
            .WithClosingCosts(credits: 3_000m)
            .WithSellerOffer(yearsKept: 10, rateCutPerPoint: 0.375m)
            .WithAffordability(150_000m, 600m)
            .WithRentOrBuy(2_100m)
            .WithDiscountPoints(1.375m, 6.875m);

        AssertValid(request, "every optional section filled with sensible values must pass");
    }

    [Test]
    public void ZeroDownPayment_IsAllowed_ForAVaLoan()
    {
        Assert.Multiple(() =>
        {
            AssertNoErrorFor(A.Request.WithDownPayment(0m).WithProgram(LoanProgramType.Va), nameof(AmortizationRequest.DownPayment),
                "VA's 100% financing is a real product");
            AssertInvalid(A.Request.WithDownPayment(0m).WithFirstPaymentDate(null), nameof(AmortizationRequest.DownPayment),
                "a conventional loan needs at least 3% down");
        });
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
    public void BuydownPaidBy_UndefinedEnumValue_IsRejected()
    {
        AssertInvalid(A.Request.WithBuydown(2m, 1m).WithBuydownPaidBy((BuydownFunding)9), nameof(AmortizationRequest.BuydownPaidBy),
            "only the seller or the borrower can pay for a buydown");
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

    // ---------------------------------------------------------------------------------------
    // Closing costs.
    // ---------------------------------------------------------------------------------------

    private static IEnumerable<TestCaseData> InvalidClosingCosts()
    {
        TestCaseData Case(string path, AmortizationRequestBuilder request) =>
            new TestCaseData(request.Build(), $"ClosingCosts.{path}").SetName($"Closing {path} out of range");

        yield return Case("LoanCosts", A.Request.WithClosingCosts(loanCosts: -1m));
        yield return Case("LoanCosts", A.Request.WithClosingCosts(loanCosts: 4_000.001m));
        yield return Case("OtherFees", A.Request.WithClosingCosts(otherFees: 1_000_000.01m));
        yield return Case("PrepaidInterestDays", A.Request.WithClosingCosts(prepaidInterestDays: 32));
        yield return Case("EscrowMonths", A.Request.WithClosingCosts(escrowMonths: -1));
        yield return Case("Credits", A.Request.WithClosingCosts(credits: -0.01m));
        yield return Case("LenderCredits", A.Request.WithClosingCosts(lenderCredits: -0.01m));
        yield return Case("LenderCredits", A.Request.WithClosingCosts(lenderCredits: 0.001m));
    }

    [TestCaseSource(nameof(InvalidClosingCosts))]
    public void ClosingCost_OutOfRange_IsRejected(AmortizationRequest request, string path)
    {
        AssertInvalid(request, path, "each closing-cost field has the range a Loan Estimate allows");
    }

    [TestCase(-0.01, 0, 0, "RentOrBuy.OwnerTaxes.MarginalTaxRatePercent", TestName = "A tax rate below nothing")]
    [TestCase(50.01, 0, 0, "RentOrBuy.OwnerTaxes.MarginalTaxRatePercent", TestName = "A tax rate past 50%")]
    [TestCase(24, -1, 0, "RentOrBuy.OwnerTaxes.OtherStateAndLocalTaxes", TestName = "Other state and local taxes below nothing")]
    [TestCase(24, 0.001, 0, "RentOrBuy.OwnerTaxes.OtherStateAndLocalTaxes", TestName = "Other state and local taxes to a fraction of a cent")]
    [TestCase(24, 100_000_000.01, 0, "RentOrBuy.OwnerTaxes.OtherStateAndLocalTaxes", TestName = "Other state and local taxes past $100 million")]
    [TestCase(24, 0, -1, "RentOrBuy.OwnerTaxes.OtherItemizedDeductions", TestName = "Other deductions below nothing")]
    public void OwnerTaxes_OutOfRange_IsRejected(decimal rate, decimal stateAndLocal, decimal other, string path)
    {
        AssertInvalid(A.Request.WithRentOrBuy(2_000m).WithOwnerTaxes(TaxFilingStatus.Single, rate, stateAndLocal, other), path, "a tax profile is a rate and amounts a person could have");
    }

    [Test]
    public void OwnerTaxes_AtTheEdgesOfTheirRanges_AreAccepted()
    {
        AssertValid(A.Request.WithRentOrBuy(2_000m).WithOwnerTaxes(TaxFilingStatus.HeadOfHousehold, 50m, 100_000_000m, 0m), "the edges are tax profiles");
    }

    [TestCase(-0.01, 15, "Sale.SellingCostPercent", TestName = "Selling costs below nothing")]
    [TestCase(20.01, 15, "Sale.SellingCostPercent", TestName = "Selling costs over 20%")]
    [TestCase(6, -0.01, "Sale.GainsTaxRatePercent", TestName = "A gains tax rate below nothing")]
    [TestCase(6, 40.01, "Sale.GainsTaxRatePercent", TestName = "A gains tax rate over 40%")]
    public void Sale_OutOfRange_IsRejected(decimal selling, decimal gainsTaxRate, string path)
    {
        AssertInvalid(A.Request.WithSale(selling, TaxFilingStatus.Single, gainsTaxRate), path, "costs and a tax rate a market could have");
    }

    [Test]
    public void Sale_AtTheEdgesOfItsRanges_IsAccepted()
    {
        AssertValid(A.Request.WithSale(0m, TaxFilingStatus.HeadOfHousehold, 40m), "the edges are assumptions a seller could face");
        AssertValid(A.Request.WithSale(20m, TaxFilingStatus.MarriedFilingJointly, 0m), "so is the other end");
    }

    [TestCase(0, 3.5, 7, 1, 6, "RentOrBuy.MonthlyRent", TestName = "No rent")]
    [TestCase(2_000.001, 3.5, 7, 1, 6, "RentOrBuy.MonthlyRent", TestName = "Rent to a fraction of a cent")]
    [TestCase(2_000, 20.01, 7, 1, 6, "RentOrBuy.RentIncreasePercent", TestName = "Rent rising more than 20% a year")]
    [TestCase(2_000, 3.5, 30.01, 1, 6, "RentOrBuy.InvestmentReturnPercent", TestName = "Investments earning more than 30%")]
    [TestCase(2_000, 3.5, 7, -0.01, 6, "RentOrBuy.MaintenancePercent", TestName = "Upkeep below nothing")]
    [TestCase(2_000, 3.5, 7, 1, 20.01, "RentOrBuy.SellingCostPercent", TestName = "Selling costs over 20%")]
    public void RentOrBuy_OutOfRange_IsRejected(decimal rent, decimal increase, decimal investmentReturn, decimal maintenance, decimal selling, string path)
    {
        AssertInvalid(A.Request.WithRentOrBuy(rent, increase, investmentReturn, maintenance, selling), path, "assumptions a market could have");
    }

    [TestCase(0, TestName = "A budget of nothing")]
    [TestCase(-1, TestName = "A budget below zero")]
    [TestCase(1_000_000.01, TestName = "A budget past a million a month")]
    [TestCase(1_800.001, TestName = "A budget to a fraction of a cent")]
    public void MonthlyBudget_OutOfRange_IsRejected(decimal budget)
    {
        AssertInvalid(A.Request.WithMonthlyBudget(budget), "MonthlyBudget", "a payment a month, in dollars and cents");
    }

    [TestCase(0.01)]
    [TestCase(1_000_000)]
    public void MonthlyBudget_AtTheEdgesOfItsRange_IsAccepted(decimal budget)
    {
        AssertValid(A.Request.WithMonthlyBudget(budget), "the edges are budgets");
    }

    [TestCase(0, 0, "Affordability.AnnualIncome", TestName = "No income")]
    [TestCase(100_000_000.01, 0, "Affordability.AnnualIncome", TestName = "An income past $100 million")]
    [TestCase(90_000.001, 0, "Affordability.AnnualIncome", TestName = "An income to a fraction of a cent")]
    [TestCase(90_000, -1, "Affordability.MonthlyDebts", TestName = "Debts below zero")]
    [TestCase(90_000, 0.001, "Affordability.MonthlyDebts", TestName = "Debts to a fraction of a cent")]
    [TestCase(90_000, 8_333_333.34, "Affordability.MonthlyDebts", TestName = "Debts past a twelfth of the most income")]
    public void Affordability_OutOfRange_IsRejected(decimal income, decimal debts, string path)
    {
        AssertInvalid(A.Request.WithAffordability(income, debts), path, "a household's income and debts, in dollars and cents");
    }

    [TestCase(0, 0, 0, "Affordability.CoBuyers[0].AnnualIncome", TestName = "A co-buyer with no income")]
    [TestCase(100_000_000.01, 0, 0, "Affordability.CoBuyers[0].AnnualIncome", TestName = "A co-buyer with an income past $100 million")]
    [TestCase(60_000, -1, 0, "Affordability.CoBuyers[0].MonthlyDebts", TestName = "A co-buyer with debts below zero")]
    [TestCase(60_000, 0.001, 0, "Affordability.CoBuyers[0].MonthlyDebts", TestName = "A co-buyer with debts to a fraction of a cent")]
    [TestCase(60_000, 0, -1, "Affordability.CoBuyers[0].DownPaymentPercent", TestName = "A co-buyer putting in less than none of the down payment")]
    [TestCase(60_000, 0, 100.01, "Affordability.CoBuyers[0].DownPaymentPercent", TestName = "A co-buyer putting in more than all of it")]
    [TestCase(60_000, 0, 33.333, "Affordability.CoBuyers[0].DownPaymentPercent", TestName = "A share to more than two decimals")]
    public void CoBuyer_OutOfRange_IsRejected(decimal income, decimal debts, decimal percent, string path)
    {
        AssertInvalid(A.Request.WithAffordability(90_000m).WithCoBuyer(income, debts, percent), path, "a co-buyer's income, debts and share of the down payment");
    }

    [Test]
    public void CoBuyers_PuttingInAllOfTheDownPayment_AreAccepted() =>
        AssertValid(A.Request.WithAffordability(90_000m).WithCoBuyer(60_000m, 0m, 60m).WithCoBuyer(50_000m, 0m, 40m), "the shares may add up to exactly all of it: the first buyer then puts in none");

    [Test]
    public void ACoBuyer_WithDebtsAtAndPastATwelfthOfTheMostIncome_IsAcceptedThenRejected()
    {
        AssertValid(A.Request.WithAffordability(90_000m).WithCoBuyer(60_000m, 8_333_333m), "debts up to a twelfth of the most income a year");
        AssertInvalid(A.Request.WithAffordability(90_000m).WithCoBuyer(60_000m, 8_333_333.34m), "Affordability.CoBuyers[0].MonthlyDebts", "and past it");
    }

    [Test]
    public void CoBuyers_PuttingInMoreThanTheWholeDownPayment_AreRejected()
    {
        AssertInvalid(A.Request.WithAffordability(90_000m).WithCoBuyer(60_000m, 0m, 60m).WithCoBuyer(50_000m, 0m, 50m), "Affordability.CoBuyers", "the shares of the down payment leave the first buyer with a negative share");
    }

    [Test]
    public void MoreCoBuyers_ThanTheLimit_AreRejected()
    {
        var request = A.Request.WithAffordability(90_000m);
        for (var i = 0; i <= AmortizationRequestValidator.MaxCoBuyers; i++)
            request = request.WithCoBuyer(50_000m);

        AssertInvalid(request, "Affordability.CoBuyers", "a loan has a few buyers, not a crowd");
    }

    [Test]
    public void CoBuyers_UpToTheLimit_AreAccepted()
    {
        var request = A.Request.WithAffordability(90_000m);
        for (var i = 0; i < AmortizationRequestValidator.MaxCoBuyers; i++)
            request = request.WithCoBuyer(50_000m, 100m, 25m);

        AssertValid(request, "three co-buyers putting in 25% each leave the first buyer 25%");
    }

    [TestCase(0, 0.25, "SellerOffer.YearsKept", TestName = "An offer weighed over no years")]
    [TestCase(51, 0.25, "SellerOffer.YearsKept", TestName = "An offer weighed over more than 50 years")]
    [TestCase(7, 0, "SellerOffer.RateCutPerPoint", TestName = "Points that cut no rate")]
    [TestCase(7, 1.01, "SellerOffer.RateCutPerPoint", TestName = "A point that cuts more than a percentage point")]
    [TestCase(7, 0.0001, "SellerOffer.RateCutPerPoint", TestName = "A cut per point to more than three decimals")]
    public void SellerOffer_OutOfRange_IsRejected(int yearsKept, decimal rateCutPerPoint, string path)
    {
        AssertInvalid(A.Request.WithClosingCosts(credits: 5_000m).WithSellerOffer(yearsKept, rateCutPerPoint), path, "the offer is weighed over a loan's years, with points lenders sell");
    }

    [TestCase(0, 7, "DiscountPoints.Points", TestName = "No points")]
    [TestCase(5.01, 7, "DiscountPoints.Points", TestName = "More than five points")]
    [TestCase(1.0001, 7, "DiscountPoints.Points", TestName = "Points to more than three decimals")]
    [TestCase(1, 6.5, "DiscountPoints.RateWithoutPoints", TestName = "A rate without points no higher than with them")]
    [TestCase(1, 30.01, "DiscountPoints.RateWithoutPoints", TestName = "A rate without points over 30%")]
    public void DiscountPoints_OutOfRange_AreRejected(decimal points, decimal rateWithoutPoints, string path)
    {
        AssertInvalid(A.Request.WithRate(6.5m).WithDiscountPoints(points, rateWithoutPoints), path, "points buy a lower rate, within what lenders sell");
    }

    [Test]
    public void AnFhaLoan_NeedsThreePointFivePercentDown()
    {
        var request = A.Request.WithHomePrice(300_000m).WithDownPayment(10_499.99m).WithProgram(LoanProgramType.Fha);

        AssertErrorMessage(request, "DownPayment", "An FHA loan needs at least 3.5% down.", "FHA's minimum down payment");
    }

    [Test]
    public void AVaLoan_NeedsNoDownPayment()
    {
        AssertValid(A.Request.WithDownPayment(0m).WithProgram(LoanProgramType.Va, VaFundingFeeType.FirstUse), "a VA loan can be 100% financed");
    }

    [TestCase(LoanProgramType.Fha, TestName = "PMI on an FHA loan")]
    [TestCase(LoanProgramType.Va, TestName = "PMI on a VA loan")]
    public void Pmi_IsRejected_OnAGovernmentLoan(LoanProgramType type)
    {
        var request = A.Request.WithProgram(type).WithHousingCosts(c => c.WithPmi(0.5m));

        AssertErrorMessage(request, "HousingCosts.PmiRate", "FHA and VA loans have no PMI: FHA has its own mortgage insurance, worked out from the loan, and VA none.",
            "PMI that would be silently ignored is a client mistake");
    }

    [Test]
    public void AFundingFeeUse_IsOnlyForAVaLoan()
    {
        AssertInvalid(A.Request.WithProgram(LoanProgramType.Fha, VaFundingFeeType.SubsequentUse), "Program.VaUse", "only a VA loan has a funding fee");
    }

    [Test]
    public void AnUnknownProgram_IsRejected()
    {
        AssertInvalid(A.Request.WithProgram((LoanProgramType)7), "Program.Type", "only conventional, FHA and VA loans are modelled");
    }

    [Test]
    public void DiscountPoints_OnAnAdjustableRate_AreRejected()
    {
        AssertErrorMessage(A.Request.WithRate(6.5m).WithAdjustableRate(7.5m).WithDiscountPoints(1m, 6.75m), "DiscountPoints",
            "Discount points are compared on a fixed rate; an adjustable rate's resets would differ.", "the two rates would reset differently, so there is no fair comparison");
    }

    [Test]
    public void ClosingCosts_AtTheirLimits_AreValid()
    {
        AssertValid(A.Request.WithClosingCosts(0m, 1_000_000m, prepaidInterestDays: 31, escrowMonths: 14, credits: 1_000_000m, lenderCredits: 1_000_000m),
            "a month of interest, 14 months of escrow and large fees and credits are all possible");
    }

    [Test]
    public void ClosingCostMessages_NameTheFields()
    {
        AssertErrorMessage(A.Request.WithClosingCosts(escrowMonths: 15), "ClosingCosts.EscrowMonths",
            "'Months of escrow' must be between 0 and 14. You entered 15.", "the message names the field as the form does");
    }

    // ---------------------------------------------------------------------------------------
    // Tax rate changes and a transferred ceiling.
    // ---------------------------------------------------------------------------------------

    private static IEnumerable<TestCaseData> InvalidRateChanges()
    {
        TestCaseData Case(string name, string path, Func<HousingCostsRequestBuilder, HousingCostsRequestBuilder> costs) =>
            new TestCaseData(A.Request.WithHousingCosts(costs).Build(), $"HousingCosts.{path}").SetName(name);

        yield return Case("RateChange_InTheFirstYear", "RateChanges[0].FromYear", c => c.WithPropertyTax(2m).WithRateChange(1, propertyTaxRate: 1.5m));
        yield return Case("RateChange_AfterTheLoan", "RateChanges[0].FromYear", c => c.WithPropertyTax(2m).WithRateChange(31, propertyTaxRate: 1.5m));
        yield return Case("RateChange_TwiceInOneYear", "RateChanges", c => c.WithPropertyTax(2m).WithRateChange(3, propertyTaxRate: 1.5m).WithRateChange(3, propertyTaxRate: 1.6m));
        yield return Case("RateChange_ChangingNothing", "RateChanges[0]", c => c.WithPropertyTax(2m).WithRateChange(3));
        yield return Case("RateChange_ForATaxNotCharged", "RateChanges[0].MudTaxRate", c => c.WithSchoolTax(1m).WithRateChange(3, mudTaxRate: 0.5m));
        yield return Case("RateChange_ForTheSeparateTaxes_WithOneRate", "RateChanges[0].SchoolTaxRate", c => c.WithPropertyTax(2m).WithRateChange(3, schoolTaxRate: 1m));
        yield return Case("RateChange_TooHigh", "RateChanges[0].PropertyTaxRate", c => c.WithPropertyTax(2m).WithRateChange(3, propertyTaxRate: 15.01m));
        yield return Case("TransferredCeiling_OfNothing", "Over65OrDisabled.TransferredCeilingPercent",
            c => c.WithSchoolTax(1m).AsHomestead().WithOver65(transferredCeilingPercent: 0m));
        yield return Case("TransferredCeiling_AboveTheWholeTax", "Over65OrDisabled.TransferredCeilingPercent",
            c => c.WithSchoolTax(1m).AsHomestead().WithOver65(transferredCeilingPercent: 100.01m));
    }

    [TestCaseSource(nameof(InvalidRateChanges))]
    public void RateChangesAndTransfers_ThatCannotBe_AreRejected(AmortizationRequest request, string path)
    {
        AssertInvalid(request, path, "each change is a later year within the loan, for a tax that is charged, within its limits");
    }

    [Test]
    public void RateChangesAndATransferredCeiling_CanBeSent()
    {
        AssertValid(A.Request.WithHousingCosts(c => c.WithSchoolTax(1m).WithLocalTax(1.1m).AsHomestead()
                .WithOver65(transferredCeilingPercent: 40m)
                .WithRateChange(3, schoolTaxRate: 0.9m).WithRateChange(6, schoolTaxRate: 0.85m, localTaxRate: 1.2m)),
            "a few years of new rates, and a ceiling brought from a former home");
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

    [Test]
    public void ABuydownOrAnAdjustableRate_IsValid()
    {
        Assert.Multiple(() =>
        {
            AssertValid(A.Request.WithBuydown(2m, 1m), "a 2-1 buydown");
            AssertValid(A.Request.WithBuydown(3m, 2m, 1m), "a 3-2-1 buydown");
            AssertValid(A.Request.WithAdjustableRate(7.5m), "a 7/1 ARM");
            AssertValid(A.Request.WithAdjustableRate(7.5m, initialFixedMonths: 60, intervalMonths: 6, initialCap: 2m, periodicCap: 1m), "a 5/6 ARM with 2/1/5 caps");
        });
    }

    [Test]
    public void ABuydownAndAnAdjustableRateTogether_AreRejected() =>
        AssertInvalid(A.Request.WithBuydown(2m, 1m).WithAdjustableRate(7m), "AdjustableRate", "a loan is one or the other");

    [Test]
    public void AnUnusableBuydown_IsRejected()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(A.Request.WithBuydown(), "Buydown.YearlyReductions", "at least one year");
            AssertInvalid(A.Request.WithBuydown(3m, 2m, 1m, 0.5m), "Buydown.YearlyReductions", "at most three years");
            AssertInvalid(A.Request.WithBuydown(3.5m), "Buydown.YearlyReductions[0]", "at most three points off");
            AssertInvalid(A.Request.WithBuydown(0m), "Buydown.YearlyReductions[0]", "a year with no reduction is no buydown");
        });
    }

    [Test]
    public void AnUnusableAdjustableRate_IsRejected()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(A.Request.WithAdjustableRate(7m, initialFixedMonths: 360), "AdjustableRate.InitialFixedMonths", "the fixed period must end before the loan does");
            AssertInvalid(A.Request.WithAdjustableRate(7m, intervalMonths: 0), "AdjustableRate.AdjustmentIntervalMonths", "the rate must reset at some interval");
            AssertInvalid(A.Request.WithAdjustableRate(31m), "AdjustableRate.ExpectedRate", "the expected rate has the usual limits");
            AssertInvalid(A.Request.WithAdjustableRate(7m, lifetimeCap: 11m), "AdjustableRate.LifetimeCap", "caps of at most 10 points");
        });
    }

    [Test]
    public void OnePropertyTaxRate_IsUsedInsteadOfTheSeparateRates_NotWithThem()
    {
        Assert.Multiple(() =>
        {
            AssertValid(A.Request.WithHousingCosts(c => c.WithPropertyTax(2.2m, 50_000m)), "one combined rate and a homestead exemption");
            AssertInvalid(A.Request.WithHousingCosts(c => c.WithPropertyTax(2.2m, 50_000m).WithSchoolTax(1m)), "HousingCosts.PropertyTaxRate", "not with separate rates too");
            AssertInvalid(A.Request.WithHousingCosts(c => c.WithPropertyTax(2.2m, 50_000m).AsHomestead().WithOver65()), "HousingCosts.Over65OrDisabled",
                "over-65 relief needs the separate taxes");
            AssertInvalid(A.Request.WithHousingCosts(c => c.WithPropertyTax(16m)), "HousingCosts.PropertyTaxRate", "at most 15%");
        });
    }

    [Test]
    public void AnArmsMargin_IsAFloorNoHigherThanTheStartingRate()
    {
        var request = A.Request.WithAdjustableRate(7.5m).Build();
        AmortizationRequest arm(decimal margin) => request with { AdjustableRate = request.AdjustableRate! with { Margin = margin } };

        Assert.Multiple(() =>
        {
            AssertValid(arm(2.75m), "a usual margin");
            AssertInvalid(arm(6.5m), "AdjustableRate.Margin", "above the 6% starting rate");
            AssertInvalid(arm(-1m), "AdjustableRate.Margin", "negative");
        });
    }

    // ---------------------------------------------------------------------------------------
    // Limits at their edges, and rules no other test reached.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void ALargeDownPayment_DoesNotCountTowardTheLoanLimit()
    {
        AssertNoErrorFor(A.Request.WithHomePrice(90_000_000m).WithDownPayment(20_000_000m), "DownPayment",
            "the loan is the price less the down payment: $70 million is within the limit");
    }

    [Test]
    public void AnFhaLoan_WithExactly3Point5PercentDown_IsValid()
    {
        AssertNoErrorFor(A.Request.WithHomePrice(300_000m).WithDownPayment(10_500m).WithProgram(LoanProgramType.Fha), "DownPayment",
            "the minimum itself is enough");
    }

    [Test]
    public void AnUnknownVaFundingFeeUse_IsRejected()
    {
        AssertInvalid(A.Request.WithProgram(LoanProgramType.Va, (VaFundingFeeType)9), "Program.VaUse", "only first use, later use or exempt");
    }

    [Test]
    public void AMonthlyExtraStartingAfterTheLoan_IsRejected()
    {
        AssertInvalid(A.Request.WithMonthlyExtra(100m, startingPaymentNumber: 361), "ExtraPayments.MonthlyStartingPaymentNumber",
            "a monthly extra must start within the loan");
    }

    [Test]
    public void AYearlyExtra_CanBeZero_ButNotNegative()
    {
        Assert.Multiple(() =>
        {
            AssertNoErrorFor(A.Request.WithAnnualExtra(0m), "ExtraPayments.Annual.Amount", "a zero yearly extra is no yearly extra");
            AssertErrorMessage(A.Request.WithAnnualExtra(-1m), "ExtraPayments.Annual.Amount",
                "'Annual extra payment' must be greater than or equal to '0'.", "named the way the form names it");
        });
    }

    [Test]
    public void TheMostLumpSumsAllowed_AreValid()
    {
        var lumpSums = Enumerable.Range(1, AmortizationRequestValidator.MaxLumpSums).Select(n => new LumpSumPaymentRequest(n, 100m)).ToList();

        AssertNoErrorFor(A.Request.WithLumpSums(lumpSums), "ExtraPayments.LumpSums", "the limit itself is allowed");
    }

    [TestCase(0, TestName = "RateChange_ToZero")]
    [TestCase(15, TestName = "RateChange_ToTheMostAllowed")]
    public void ARateChange_AtItsLimits_IsValid(decimal rate)
    {
        AssertValid(A.Request.WithHousingCosts(c => c.WithPropertyTax(2m).WithRateChange(3, propertyTaxRate: rate)), "a rate can change to 0 or to its limit");
    }

    private static IEnumerable<TestCaseData> RateChangeMessages()
    {
        TestCaseData Case(string name, string path, string message, Func<HousingCostsRequestBuilder, HousingCostsRequestBuilder> costs) =>
            new TestCaseData(A.Request.WithHousingCosts(costs).Build(), $"HousingCosts.RateChanges[0].{path}", message).SetName(name);

        yield return Case("PropertyRateChangeMessage", "PropertyTaxRate", "'Property tax rate' must be between 0 and 15, with at most 4 decimal places.",
            c => c.WithPropertyTax(2m).WithRateChange(3, propertyTaxRate: 16m));
        yield return Case("SchoolRateChangeMessage", "SchoolTaxRate", "'School tax rate' must be between 0 and 10, with at most 4 decimal places.",
            c => c.WithSchoolTax(1m).WithRateChange(3, schoolTaxRate: 11m));
        yield return Case("LocalRateChangeMessage", "LocalTaxRate", "'County/city tax rate' must be between 0 and 10, with at most 4 decimal places.",
            c => c.WithLocalTax(1m).WithRateChange(3, localTaxRate: 11m));
        yield return Case("MudRateChangeMessage", "MudTaxRate", "'MUD tax rate' must be between 0 and 5, with at most 4 decimal places.",
            c => c.WithMudTax(1m).WithRateChange(3, mudTaxRate: 6m));
    }

    [TestCaseSource(nameof(RateChangeMessages))]
    public void ARateChangeOutOfRange_SaysWhichTax(AmortizationRequest request, string path, string message)
    {
        AssertErrorMessage(request, path, message, "each tax's change is checked against that tax's own limit");
    }

    [Test]
    public void AmountsAndRatesWithTrailingZeros_AreValid()
    {
        AssertValid(A.Request.WithHomePrice(375_000.000m).WithRate(6.50000m), "375,000.000 is whole cents and 6.50000 is two decimals");
    }

    [TestCase("PropertyTaxHomesteadExemption", TestName = "HomesteadExemption_Negative")]
    [TestCase("MudHomesteadExemptionPercent", TestName = "MudExemption_Above100")]
    public void MoreHousingCostLimits_AreChecked(string field)
    {
        var request = A.Request.WithHousingCosts(c => c.With(h => field == "MudHomesteadExemptionPercent"
            ? h with { MudHomesteadExemptionPercent = 100.01m }
            : h with { PropertyTaxHomesteadExemption = -1m }));

        AssertInvalid(request, $"HousingCosts.{field}", "each exemption has its range");
    }

    // ---------------------------------------------------------------------------------------
    // How the home is used: the most a conventional loan may be, FHA and VA, and a homestead.
    // ---------------------------------------------------------------------------------------

    /// <summary>$400,000 with the given down payment, used as said: a loan still to be made (its first payment next month).</summary>
    private static AmortizationRequestBuilder Used(OccupancyType occupancy, decimal down) =>
        A.Request.WithHomePrice(400_000m).WithDownPayment(down).WithOccupancy(occupancy).WithFirstPaymentDate(null);

    [Test]
    public void AConventionalLoan_IsAtMost97PercentOfAHomeLivedIn_Or95WithAnAdjustableRate()
    {
        Assert.Multiple(() =>
        {
            AssertNoErrorFor(Used(OccupancyType.PrimaryResidence, 12_000m), "DownPayment", "3% down: a 97% loan");
            AssertErrorMessage(Used(OccupancyType.PrimaryResidence, 11_999.99m), "DownPayment",
                "A conventional loan can be at most 97% of the price of a home you live in: put at least 3% down.", "a cent less is past 97%");
            AssertErrorMessage(Used(OccupancyType.PrimaryResidence, 12_000m).WithAdjustableRate(7m), "DownPayment",
                "A conventional loan with an adjustable rate can be at most 95% of the price of a home you live in: put at least 5% down.",
                "an ARM is held to 95%");
            AssertNoErrorFor(Used(OccupancyType.PrimaryResidence, 20_000m).WithAdjustableRate(7m), "DownPayment", "5% down with an ARM");
        });
    }

    [Test]
    public void AConventionalLoan_IsAtMost90PercentOfASecondHome_And85OfAnInvestmentProperty()
    {
        Assert.Multiple(() =>
        {
            AssertNoErrorFor(Used(OccupancyType.SecondHome, 40_000m), "DownPayment", "10% down on a second home");
            AssertErrorMessage(Used(OccupancyType.SecondHome, 39_999.99m), "DownPayment",
                "A conventional loan can be at most 90% of the price of a second home: put at least 10% down.", "past 90%");
            AssertNoErrorFor(Used(OccupancyType.InvestmentProperty, 60_000m), "DownPayment", "15% down on an investment property");
            AssertErrorMessage(Used(OccupancyType.InvestmentProperty, 59_999.99m), "DownPayment",
                "A conventional loan can be at most 85% of the price of an investment property: put at least 15% down.", "past 85%");
        });
    }

    [Test]
    public void FhaAndVa_AreOnlyForAHomeLivedIn()
    {
        Assert.Multiple(() =>
        {
            AssertErrorMessage(Used(OccupancyType.SecondHome, 100_000m).WithProgram(LoanProgramType.Fha), "Occupancy",
                "FHA and VA loans are only for a home you will live in.", "FHA insures a principal residence");
            AssertErrorMessage(Used(OccupancyType.InvestmentProperty, 100_000m).WithProgram(LoanProgramType.Va), "Occupancy",
                "FHA and VA loans are only for a home you will live in.", "VA asks the veteran to live there");
            AssertNoErrorFor(Used(OccupancyType.PrimaryResidence, 14_000m).WithProgram(LoanProgramType.Fha), "Occupancy", "a home lived in");
            AssertNoErrorFor(Used(OccupancyType.InvestmentProperty, 60_000m), "Occupancy", "a conventional loan can be on any home");
            AssertNoErrorFor(Used(OccupancyType.SecondHome, 0m).WithProgram(LoanProgramType.Va), "DownPayment",
                "the conventional limits are not FHA's or VA's");
        });
    }

    [Test]
    public void AHomesteadExemption_IsOnlyForAHomeLivedIn()
    {
        Assert.Multiple(() =>
        {
            AssertErrorMessage(Used(OccupancyType.InvestmentProperty, 100_000m).WithHousingCosts(c => c.WithSchoolTax(1m).AsHomestead()),
                "HousingCosts.IsHomestead", "A homestead exemption is only for the home you live in.", "Texas: the owner's principal residence");
            AssertNoErrorFor(Used(OccupancyType.SecondHome, 100_000m).WithHousingCosts(c => c.WithSchoolTax(1m)), "HousingCosts.IsHomestead",
                "a second home taxed in full");
            AssertNoErrorFor(Used(OccupancyType.PrimaryResidence, 100_000m).WithHousingCosts(c => c.WithSchoolTax(1m).AsHomestead()),
                "HousingCosts.IsHomestead", "a home lived in");
        });
    }

    [Test]
    public void ALoanAlreadyBeingPaid_IsNotHeldToTheLimitsOfOneBeingMade()
    {
        // Its first payment was in January 2026: what is owed now can be more than the home is worth.
        var paying = A.Request.WithHomePrice(420_000m).WithDownPayment(0m).WithFirstPaymentDate(new DateOnly(2026, 1, 1));

        Assert.Multiple(() =>
        {
            AssertNoErrorFor(paying, "DownPayment", "the limits are for a loan being made");
            AssertInvalid(paying.WithFirstPaymentDate(DateOnly.FromDateTime(DateTime.Today)), "DownPayment",
                "a first payment due today is not yet made: a loan being made");
        });
    }

    [Test]
    public void AnOccupancyOutsideTheList_IsRejected()
    {
        AssertInvalid(Used((OccupancyType)7, 100_000m), "Occupancy", "only the three uses");
    }

    // ---------------------------------------------------------------------------------------
    // FHA's credit-score tiers and county loan limits.
    // ---------------------------------------------------------------------------------------

    /// <summary>$300,000 with the given down payment, as an FHA loan.</summary>
    private static AmortizationRequestBuilder Fha(decimal down, int? creditScore = null, string? county = null) =>
        A.Request.WithHomePrice(300_000m).WithDownPayment(down).WithProgram(LoanProgramType.Fha, creditScore: creditScore, countyFips: county);

    [Test]
    public void ACreditScoreBelow580_NeedsTenPercentDown()
    {
        Assert.Multiple(() =>
        {
            AssertErrorMessage(Fha(10_500m, creditScore: 579), "DownPayment", "With a credit score below 580, an FHA loan needs at least 10% down.",
                "a score from 500 to 579 limits the loan to 90% of the value");
            AssertNoErrorFor(Fha(30_000m, creditScore: 579), "DownPayment", "10% down is enough");
            AssertNoErrorFor(Fha(10_500m, creditScore: 580), "DownPayment", "from 580, 3.5% is enough");
            AssertErrorMessage(Fha(10_500m, creditScore: 500), "DownPayment", "With a credit score below 580, an FHA loan needs at least 10% down.",
                "500 is the lowest score FHA insures, and it needs 10% down too");
        });
    }

    [Test]
    public void ACreditScoreBelow500_IsRefused()
    {
        Assert.Multiple(() =>
        {
            AssertErrorMessage(Fha(60_000m, creditScore: 499), "Program.CreditScore", "FHA insures loans only for credit scores of 500 or more.",
                "no down payment makes up for it");
            AssertErrorMessage(Fha(60_000m, creditScore: 300), "Program.CreditScore", "FHA insures loans only for credit scores of 500 or more.",
                "down to the lowest score on the scale");
        });
    }

    [TestCase(299, TestName = "CreditScore_Below300")]
    [TestCase(851, TestName = "CreditScore_Above850")]
    public void ACreditScoreOutsideTheScale_IsRejected(int score)
    {
        AssertInvalid(Fha(30_000m, creditScore: score), "Program.CreditScore", "credit scores run from 300 to 850");
    }

    [Test]
    public void ALoanAboveTheCountysLimit_IsRefused_WithTheLimit()
    {
        // Bexar County, Texas: $557,750 in 2026.
        var request = A.Request.WithHomePrice(600_000m).WithDownPayment(21_000m).WithProgram(LoanProgramType.Fha, countyFips: "48029");

        AssertErrorMessage(request, "DownPayment",
            "FHA insures at most $557,750 in Bexar County, TX (2026); this loan is $579,000. Put more down, or choose another loan type.",
            "the county's limit, the loan, and what to do about it");
    }

    [Test]
    public void ALoanWithinTheCountysLimit_IsValid()
    {
        AssertNoErrorFor(A.Request.WithHomePrice(578_000m).WithDownPayment(20_250m).WithProgram(LoanProgramType.Fha, countyFips: "48029"), "DownPayment",
            "a $557,750 loan is at Bexar County's limit");
    }

    [Test]
    public void AnUnknownCounty_IsRejected()
    {
        AssertErrorMessage(Fha(10_500m, county: "99999"), "Program.CountyFips", "Choose a county from the list: '99999' is not one HUD sets a limit for.",
            "a county must be one HUD lists");
    }

    [TestCase(LoanProgramType.Va, TestName = "CountyAndScore_OnAVaLoan")]
    [TestCase(LoanProgramType.Conventional, TestName = "CountyAndScore_OnAConventionalLoan")]
    public void ACountyOrCreditScore_IsOnlyForAnFhaLoan(LoanProgramType type)
    {
        var request = A.Request.WithProgram(type, creditScore: 700, countyFips: "48029");

        Assert.Multiple(() =>
        {
            AssertInvalid(request, "Program.CreditScore", "only FHA's rules here depend on the score");
            AssertInvalid(request, "Program.CountyFips", "only FHA's limit here depends on the county");
        });
    }
}
