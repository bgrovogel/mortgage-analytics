using FluentValidation.TestHelper;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;
using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Application.Tests.Validation;

[TestFixture]
public class AmortizationRequestValidatorTests
{
    private readonly AmortizationRequestValidator _validator = new();

    private static readonly AmortizationRequest Valid = new()
    {
        HomePrice = 375_000m,
        DownPayment = 18_750m,
        AnnualInterestRate = 6.5m,
        TermInMonths = 360,
    };

    [Test]
    public void ValidRequest_HasNoErrors()
    {
        _validator.TestValidate(Valid).ShouldNotHaveAnyValidationErrors();
    }

    [Test]
    public void FullyPopulatedRequest_HasNoErrors()
    {
        var request = Valid with
        {
            FirstPaymentDate = new DateOnly(2026, 11, 1),
            Strategy = ExtraPaymentStrategy.Recast,
            Recast = new RecastTermsRequest { MinimumLumpSum = 10_000m, Fee = 250m },
            ExtraPayments = new ExtraPaymentsRequest
            {
                MonthlyAmount = 250m,
                MonthlyStartingPaymentNumber = 6,
                Annual = new AnnualExtraPaymentRequest(2_000m, 12),
                LumpSums = [new LumpSumPaymentRequest(24, 10_000m)],
            },
            HousingCosts = new HousingCostsRequest
            {
                SchoolTaxRate = 1.0m,
                PropertyTaxRate = 1.1m,
                MudTaxRate = 0.85m,
                IsHomestead = true,
                SchoolHomesteadExemption = 140_000m,
                LocalHomesteadExemptionPercent = 20m,
                HomesteadAssessmentCap = 10m,
                HomeValueGrowthRate = 3m,
                InsuranceIncreaseRate = 5m,
                HoaIncreaseRate = 3m,
                Pid = new PidAssessmentRequest(1_200m, 20),
                AnnualHomeownersInsurance = 2_400m,
                MonthlyHoaDues = 75m,
                PmiRate = 0.5m,
                PmiCancellation = MortgageInsuranceCancellation.BorrowerRequested,
            },
        };

        _validator.TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }

    // ---------------------------------------------------------------------------------------
    // Purchase and loan.
    // ---------------------------------------------------------------------------------------

    [TestCase(0)]
    [TestCase(-5)]
    [TestCase(375_000.001)]
    public void HomePrice_NonPositiveOrSubCent_IsRejected(decimal price)
    {
        _validator.TestValidate(Valid with { HomePrice = price })
            .ShouldHaveValidationErrorFor(r => r.HomePrice);
    }

    [TestCase(-1, TestName = "Negative down payment")]
    [TestCase(375_000, TestName = "Down payment equal to the price")]
    [TestCase(400_000, TestName = "Down payment above the price")]
    public void DownPayment_NegativeOrCoveringThePrice_IsRejected(decimal down)
    {
        _validator.TestValidate(Valid with { DownPayment = down })
            .ShouldHaveValidationErrorFor(r => r.DownPayment);
    }

    [Test]
    public void ZeroDownPayment_IsAllowed()
    {
        _validator.TestValidate(Valid with { DownPayment = 0m })
            .ShouldNotHaveValidationErrorFor(r => r.DownPayment);
    }

    [Test]
    public void LoanAmountAboveTheMaximum_IsReportedOnTheDownPayment()
    {
        _validator.TestValidate(Valid with { HomePrice = 200_000_000m, DownPayment = 0m })
            .ShouldHaveValidationErrorFor(r => r.DownPayment);
    }

    [TestCase(-0.1)]
    [TestCase(30.01)]
    public void InterestRate_OutOfRange_IsRejected(decimal rate)
    {
        _validator.TestValidate(Valid with { AnnualInterestRate = rate })
            .ShouldHaveValidationErrorFor(r => r.AnnualInterestRate);
    }

    [TestCase(0)]
    [TestCase(-12)]
    [TestCase(601)]
    public void Term_OutOfRange_IsRejected(int months)
    {
        _validator.TestValidate(Valid with { TermInMonths = months })
            .ShouldHaveValidationErrorFor(r => r.TermInMonths);
    }

    [Test]
    public void Strategy_UndefinedEnumValue_IsRejected()
    {
        _validator.TestValidate(Valid with { Strategy = (ExtraPaymentStrategy)99 })
            .ShouldHaveValidationErrorFor(r => r.Strategy);
    }

    [Test]
    public void FirstPaymentDate_TooFarInTheFuture_IsRejected()
    {
        _validator.TestValidate(Valid with { FirstPaymentDate = DateOnly.MaxValue })
            .ShouldHaveValidationErrorFor(r => r.FirstPaymentDate);
    }

    // ---------------------------------------------------------------------------------------
    // Recast terms.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void RecastTerms_NegativeValues_AreRejected()
    {
        var request = Valid with { Recast = new RecastTermsRequest { MinimumLumpSum = -1m, Fee = -1m } };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor("Recast.MinimumLumpSum");
        result.ShouldHaveValidationErrorFor("Recast.Fee");
    }

    // ---------------------------------------------------------------------------------------
    // Extra payments.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void NegativeMonthlyExtra_IsRejected()
    {
        var request = Valid with { ExtraPayments = new ExtraPaymentsRequest { MonthlyAmount = -1m } };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor("ExtraPayments.MonthlyAmount");
    }

    [Test]
    public void ExtraPaymentLargerThanTheLoan_IsRejected()
    {
        // The loan is $375,000 - $18,750 = $356,250.
        var request = Valid with
        {
            ExtraPayments = new ExtraPaymentsRequest { LumpSums = [new LumpSumPaymentRequest(12, 356_250.01m)] },
        };

        _validator.TestValidate(request)
            .ShouldHaveValidationErrorFor("ExtraPayments.LumpSums[0].Amount")
            .WithErrorMessage("'Amount' cannot exceed the loan amount.");
    }

    [Test]
    public void LumpSumOfZero_IsRejected()
    {
        var request = Valid with { ExtraPayments = new ExtraPaymentsRequest { LumpSums = [new LumpSumPaymentRequest(12, 0m)] } };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor("ExtraPayments.LumpSums[0].Amount");
    }

    [TestCase(0)]
    [TestCase(361)]
    public void LumpSumOutsideTheTerm_IsRejected(int paymentNumber)
    {
        var request = Valid with
        {
            ExtraPayments = new ExtraPaymentsRequest { LumpSums = [new LumpSumPaymentRequest(paymentNumber, 1_000m)] },
        };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor("ExtraPayments.LumpSums[0].PaymentNumber");
    }

    [Test]
    public void AnnualExtraStartingAfterTheTerm_IsRejected()
    {
        var request = Valid with
        {
            TermInMonths = 120,
            ExtraPayments = new ExtraPaymentsRequest { Annual = new AnnualExtraPaymentRequest(1_000m, 121) },
        };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor("ExtraPayments.Annual.FirstPaymentNumber");
    }

    [Test]
    public void TooManyLumpSums_IsRejected()
    {
        var lumpSums = Enumerable.Range(1, AmortizationRequestValidator.MaxLumpSums + 1)
            .Select(n => new LumpSumPaymentRequest(n, 1m))
            .ToList();

        var request = Valid with { ExtraPayments = new ExtraPaymentsRequest { LumpSums = lumpSums } };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor("ExtraPayments.LumpSums");
    }

    // ---------------------------------------------------------------------------------------
    // Housing costs.
    // ---------------------------------------------------------------------------------------

    [TestCase(nameof(HousingCostsRequest.PropertyTaxRate), 10.01)]
    [TestCase(nameof(HousingCostsRequest.PropertyTaxRate), -0.01)]
    [TestCase(nameof(HousingCostsRequest.MudTaxRate), 5.01)]
    [TestCase(nameof(HousingCostsRequest.PmiRate), 5.01)]
    [TestCase(nameof(HousingCostsRequest.AnnualHomeownersInsurance), -1)]
    [TestCase(nameof(HousingCostsRequest.MonthlyHoaDues), 75.001)]
    [TestCase(nameof(HousingCostsRequest.SchoolTaxRate), 10.01)]
    [TestCase(nameof(HousingCostsRequest.LocalHomesteadExemptionPercent), 100.01)]
    [TestCase(nameof(HousingCostsRequest.HomesteadAssessmentCap), -1)]
    [TestCase(nameof(HousingCostsRequest.HomeValueGrowthRate), 25.01)]
    [TestCase(nameof(HousingCostsRequest.HomeValueGrowthRate), -20.01)]
    [TestCase(nameof(HousingCostsRequest.InsuranceIncreaseRate), 50.01)]
    [TestCase(nameof(HousingCostsRequest.HoaIncreaseRate), -20.01)]
    [TestCase(nameof(HousingCostsRequest.SchoolHomesteadExemption), -1)]
    public void HousingCost_OutOfRangeOrSubCent_IsRejected(string property, decimal value)
    {
        var costs = property switch
        {
            nameof(HousingCostsRequest.PropertyTaxRate) => new HousingCostsRequest { PropertyTaxRate = value },
            nameof(HousingCostsRequest.MudTaxRate) => new HousingCostsRequest { MudTaxRate = value },
            nameof(HousingCostsRequest.PmiRate) => new HousingCostsRequest { PmiRate = value },
            nameof(HousingCostsRequest.AnnualHomeownersInsurance) => new HousingCostsRequest { AnnualHomeownersInsurance = value },
            nameof(HousingCostsRequest.SchoolTaxRate) => new HousingCostsRequest { SchoolTaxRate = value },
            nameof(HousingCostsRequest.LocalHomesteadExemptionPercent) => new HousingCostsRequest { LocalHomesteadExemptionPercent = value },
            nameof(HousingCostsRequest.HomesteadAssessmentCap) => new HousingCostsRequest { HomesteadAssessmentCap = value },
            nameof(HousingCostsRequest.HomeValueGrowthRate) => new HousingCostsRequest { HomeValueGrowthRate = value },
            nameof(HousingCostsRequest.InsuranceIncreaseRate) => new HousingCostsRequest { InsuranceIncreaseRate = value },
            nameof(HousingCostsRequest.HoaIncreaseRate) => new HousingCostsRequest { HoaIncreaseRate = value },
            nameof(HousingCostsRequest.SchoolHomesteadExemption) => new HousingCostsRequest { SchoolHomesteadExemption = value },
            _ => new HousingCostsRequest { MonthlyHoaDues = value },
        };

        _validator.TestValidate(Valid with { HousingCosts = costs })
            .ShouldHaveValidationErrorFor($"HousingCosts.{property}");
    }

    [TestCase(0)]
    [TestCase(51)]
    public void PidRemainingYears_OutOfRange_IsRejected(int years)
    {
        var request = Valid with { HousingCosts = new HousingCostsRequest { Pid = new PidAssessmentRequest(1_200m, years) } };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor("HousingCosts.Pid.RemainingYears");
    }

    [TestCase(0)]
    [TestCase(51)]
    public void Over65QualifyingYear_OutsideTheTerm_IsRejected(int year)
    {
        var request = Valid with
        {
            HousingCosts = new HousingCostsRequest { Over65OrDisabled = new Over65OrDisabledRequest { QualifiesInYear = year } },
        };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor("HousingCosts.Over65OrDisabled.QualifiesInYear");
    }

    [Test]
    public void Over65Exemptions_Negative_AreRejected()
    {
        var request = Valid with
        {
            HousingCosts = new HousingCostsRequest
            {
                Over65OrDisabled = new Over65OrDisabledRequest { SchoolExemption = -1m, LocalExemption = -1m },
            },
        };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor("HousingCosts.Over65OrDisabled.SchoolExemption");
        result.ShouldHaveValidationErrorFor("HousingCosts.Over65OrDisabled.LocalExemption");
    }

    [Test]
    public void PmiCancellation_UndefinedEnumValue_IsRejected()
    {
        var request = Valid with { HousingCosts = new HousingCostsRequest { PmiCancellation = (MortgageInsuranceCancellation)7 } };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor("HousingCosts.PmiCancellation");
    }
}
