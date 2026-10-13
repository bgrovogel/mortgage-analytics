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
    public void RatesWithMoreThanFourDecimals_AreRejected()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(TypicalRequest with { MarginalTaxRate = 24.12345m }, "MarginalTaxRate", "four decimal places at most");
            AssertInvalid(TypicalRequest with { ExpectedAnnualReturn = 7.12345m }, "ExpectedAnnualReturn", "market rates follow the same rule");
            AssertInvalid(TypicalRequest with { InflationRate = 3.12345m }, "InflationRate", "inflation follows the same rule");
            AssertInvalid(TypicalRequest with { HomeGrowthRate = 4.12345m }, "HomeGrowthRate", "home growth follows the same rule");
        });
    }

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

    [Test]
    public void AnAdjustableRateOrABuydown_AreChecked()
    {
        var arm = new AdjustableRateRequest { InitialFixedMonths = 60, AdjustmentIntervalMonths = 12, ExpectedRate = 8m, InitialCap = 2m, PeriodicCap = 1m, LifetimeCap = 5m };
        var buydown = new TemporaryBuydownRequest { YearlyReductions = [2m, 1m] };

        Assert.Multiple(() =>
        {
            AssertValid(TypicalRequest with { AdjustableRate = arm }, "a reset five years out");
            AssertValid(TypicalRequest with { Buydown = buydown }, "a 2-1 buydown");
            AssertInvalid(TypicalRequest with { AdjustableRate = arm with { InitialFixedMonths = TypicalRequest.RemainingTermInMonths } }, "AdjustableRate.InitialFixedMonths", "the reset must come before the loan ends");
            AssertInvalid(TypicalRequest with { Buydown = new TemporaryBuydownRequest { YearlyReductions = [4m] } }, "Buydown.YearlyReductions[0]", "at most 3 points off");
            AssertInvalid(TypicalRequest with { AdjustableRate = arm, Buydown = buydown }, "AdjustableRate", "one or the other");
        });
    }

    private static IEnumerable<TestCaseData> MoreLimits()
    {
        TestCaseData Case(string name, string path, StrategyRequest request) => new TestCaseData(request, path).SetName(name);

        yield return Case("InterestRate_Above30", "AnnualInterestRate", TypicalRequest with { AnnualInterestRate = 30.01m });
        yield return Case("HomeValue_Negative", "HomeValue", TypicalRequest with { HomeValue = -1m });
        yield return Case("MonthlyPmi_Negative", "MonthlyPmi", TypicalRequest with { MonthlyPmi = -0.01m });
        yield return Case("MonthlyPmi_Above10000", "MonthlyPmi", TypicalRequest with { MonthlyPmi = 10_000.01m });
        yield return Case("MonthlyPmi_PartCents", "MonthlyPmi", TypicalRequest with { MonthlyPmi = 150.005m });
        yield return Case("MonthlyPmi_WithoutAHomeValue", "HomeValue", TypicalRequest with { MonthlyPmi = 150m, HomeValue = 0m });
        yield return Case("MatchedShareOfPay_Above100", "MatchUpToPercentOfPay", TypicalRequest with { MatchUpToPercentOfPay = 100.01m });
        yield return Case("RetirementSavings_Negative", "CurrentRetirementSavings", TypicalRequest with { CurrentRetirementSavings = -1m });
        yield return Case("CurrentInvestments_Negative", "CurrentInvestments", TypicalRequest with { CurrentInvestments = -1m });
        yield return Case("ExpectedReturn_BelowMinus10", "ExpectedAnnualReturn", TypicalRequest with { ExpectedAnnualReturn = -10.01m });
    }

    [TestCaseSource(nameof(MoreLimits))]
    public void EachLimit_IsChecked(StrategyRequest request, string path) =>
        AssertInvalid(request, path, "every field has its range");

    [Test]
    public void AReturnOfMinus10_IsTheWorstAccepted() =>
        AssertNoErrorFor(TypicalRequest with { ExpectedAnnualReturn = -10m }, "ExpectedAnnualReturn", "a lost decade is a scenario, not an error");
}
