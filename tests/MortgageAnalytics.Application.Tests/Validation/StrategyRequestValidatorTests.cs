using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;
using static MortgageAnalytics.Testing.ReferenceStrategies;

namespace MortgageAnalytics.Application.Tests.Validation;

[TestFixture]
public class StrategyRequestValidatorTests : ValidatorTestBase<StrategyRequest, StrategyRequestValidator>
{
    [Test]
    public void TheTypicalHousehold_IsValid() => AssertValid(TypicalRequest, "the reference request passes every rule");

    [Test]
    public void NoExtraCashNoMatchAndNoInvestments_AreValid() =>
        AssertValid(TypicalRequest with
        {
            MonthlyCashToPutToWork = 0,
            EmployerMatchPercent = 0,
            MatchUpToPercentOfPay = 0,
            CurrentRetirementSavings = 0,
            CurrentInvestments = 0,
            AnnualIraContribution = 0,
            HomeValue = 0,
        }, "a household starting from nothing is an edge case, not an error");

    [TestCase(100, 4, TestName = "A 100% match on 4% of pay")]
    [TestCase(200, 100, TestName = "The largest match on all of pay")]
    [TestCase(62.5, 5.5, TestName = "Fractional percentages")]
    public void ThreeDigitAndFractionalMatchRates_AreValid(decimal match, decimal upTo) =>
        AssertValid(TypicalRequest with { EmployerMatchPercent = match, MatchUpToPercentOfPay = upTo }, "common match formulas must be accepted");

    [Test]
    public void RatesWithMoreThanFourDecimals_AreRejected() =>
        AssertInvalid(TypicalRequest with { MarginalTaxRate = 24.12345m }, "MarginalTaxRate", "four decimal places at most");

    [TestCase(0)]
    [TestCase(-1)]
    [TestCase(100_000_000.01)]
    public void AnUnusableBalance_IsRejected(decimal balance) =>
        AssertInvalid(TypicalRequest with { CurrentBalance = balance }, "CurrentBalance", "there must be a mortgage to compare against");

    [TestCase(0)]
    [TestCase(361)]
    public void PaymentsLeft_MustFitTheThirtyYearHorizon(int months) =>
        AssertInvalid(TypicalRequest with { RemainingTermInMonths = months }, "RemainingTermInMonths", "1 to 360 payments");

    [Test]
    public void TheIraContribution_IsCappedAtTheLegalLimit() =>
        AssertInvalid(TypicalRequest with { AnnualIraContribution = 7_500.01m }, "AnnualIraContribution", "$7,500 a year in 2026");

    [Test]
    public void EsppTerms_FollowSection423()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(TypicalRequest with { EsppDiscountPercent = 16 }, "EsppDiscountPercent", "at most a 15% discount");
            AssertInvalid(TypicalRequest with { EsppPurchasePeriodMonths = 0 }, "EsppPurchasePeriodMonths", "at least a month between purchases");
            AssertInvalid(TypicalRequest with { EsppPurchasePeriodMonths = 28 }, "EsppPurchasePeriodMonths", "at most 27 months");
            AssertInvalid(TypicalRequest with { EsppContributionPercent = 26 }, "EsppContributionPercent", "at most 25% of pay");
        });
    }

    [Test]
    public void TaxRates_AreCapped()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(TypicalRequest with { MarginalTaxRate = 61 }, "MarginalTaxRate", "at most 60%");
            AssertInvalid(TypicalRequest with { CapitalGainsTaxRate = -1 }, "CapitalGainsTaxRate", "no negative tax");
        });
    }

    [Test]
    public void NegativeAmounts_AreRejected()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(TypicalRequest with { MonthlyCashToPutToWork = -1 }, "MonthlyCashToPutToWork", "no negative cash");
            AssertInvalid(TypicalRequest with { AnnualRsuVesting = -1 }, "AnnualRsuVesting", "no negative RSUs");
            AssertInvalid(TypicalRequest with { AnnualEsopContribution = -1 }, "AnnualEsopContribution", "no negative ESOP");
            AssertInvalid(TypicalRequest with { OtherItemizedDeductions = -1 }, "OtherItemizedDeductions", "no negative deductions");
            AssertInvalid(TypicalRequest with { GrossAnnualIncome = 0.001m }, "GrossAnnualIncome", "whole cents");
        });
    }

    [Test]
    public void MarketAssumptions_StayInRange()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(TypicalRequest with { ExpectedAnnualReturn = 31 }, "ExpectedAnnualReturn", "returns are capped at 30%");
            AssertInvalid(TypicalRequest with { InflationRate = 21 }, "InflationRate", "inflation is capped at 20%");
            AssertInvalid(TypicalRequest with { HomeGrowthRate = 26 }, "HomeGrowthRate", "home growth is capped at 25%");
            AssertInvalid(TypicalRequest with { EmployerMatchPercent = 201 }, "EmployerMatchPercent", "a match is at most 200%");
        });
    }

    [Test]
    public void UnknownChoices_AreRejected()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(TypicalRequest with { FilingStatus = (TaxFilingStatus)9 }, "FilingStatus", "only real filing statuses");
            AssertInvalid(TypicalRequest with { RiskProfile = (InvestorRiskProfile)9 }, "RiskProfile", "only the three profiles");
        });
    }

    [Test]
    public void ANextPaymentDateFarOutsideTheCalendar_IsRejected() =>
        AssertInvalid(TypicalRequest with { NextPaymentDate = new DateOnly(1800, 1, 1) }, "NextPaymentDate", "dates must stay within the supported range");
}
