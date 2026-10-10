using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain.Strategies;
using static MortgageAnalytics.Testing.ReferenceStrategies;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// <see cref="StrategyService"/> with the real optimizer behind it (sociable), checked against the
/// independently computed <see cref="ReferenceStrategies"/>. This pins the mapping both ways.
/// </summary>
[TestFixture]
public class StrategyServiceTests
{
    private StrategyService _service = null!;

    [SetUp]
    public void CreateService() => _service = new StrategyService(new StrategyOptimizer(new StrategySimulator()), TestClock.Create());

    private static StrategyOutcomeResponse Outcome(StrategyComparisonResponse response, PayoffStrategy strategy) =>
        response.Strategies.Single(s => s.Strategy == strategy);

    [Test]
    public void Compare_ReportsTheRecommendation_AndWhatCouldReverseIt()
    {
        var response = _service.Compare(TypicalRequest);

        Assert.Multiple(() =>
        {
            Assert.That(response.Recommended, Is.EqualTo(PayoffStrategy.InvestTheDifference), "best at the risk-adjusted return");
            Assert.That(response.RunnerUp, Is.EqualTo(PayoffStrategy.Hybrid), "then the hybrid");
            Assert.That(response.Lead, Is.EqualTo(Typical.InvestTheDifference.RiskAdjustedNetWorthAtYear30 - Typical.Hybrid.RiskAdjustedNetWorthAtYear30), "by this much");
            Assert.That(response.LeadPercent, Is.EqualTo(1.6m), "in percent");
            Assert.That(response.ExpectedWinner, Is.EqualTo(PayoffStrategy.InvestTheDifference), "and at the expected return");
            Assert.That(response.BadDecadeWinner, Is.EqualTo(PayoffStrategy.PayOffFirst), "but a lost decade favors the guaranteed return");
            Assert.That(response.Strategies.Select(s => s.Strategy), Is.EqualTo(new[] { PayoffStrategy.PayOffFirst, PayoffStrategy.InvestTheDifference, PayoffStrategy.Hybrid }), "in a fixed order");
        });
    }

    [Test]
    public void Compare_MapsThePlanAndRates()
    {
        var response = _service.Compare(TypicalRequest);

        Assert.Multiple(() =>
        {
            Assert.That(response.Plan.MortgagePayment, Is.EqualTo(Typical.MortgagePayment), "the required payment");
            Assert.That(response.Plan.RetirementContributionCost, Is.EqualTo(Typical.RetirementContributionCost), "the 401(k)'s cost in take-home pay");
            Assert.That(response.Plan.ExtraCash, Is.EqualTo(Typical.ExtraCash), "the extra cash");
            Assert.That(response.Rates.FirstYearInterest, Is.EqualTo(Typical.FirstYearInterest), "year-1 interest");
            Assert.That(response.Rates.StandardDeduction, Is.EqualTo(32_200m), "the joint standard deduction");
            Assert.That(response.Rates.AfterTaxRiskAdjustedReturn, Is.EqualTo(Typical.AfterTaxRiskAdjustedReturn), "6.8%");
            Assert.That(response.Rates.RateEdge, Is.EqualTo(0.3m), "0.3 points over the mortgage");
            Assert.That(response.Rates.BadDecadeReturn, Is.EqualTo(-1m), "the lost decade");
            Assert.That(response.Rates.EmployerMatchPercent, Is.EqualTo(50m), "a 50% instant return");
            Assert.That(response.Rates.EsppGainPercent, Is.Zero, "no ESPP");
            Assert.That(response.Rates.HybridInvestPercent, Is.EqualTo(Typical.HybridInvestPercent), "the hybrid's split");
        });
    }

    [Test]
    public void Compare_MapsEveryYearOfEveryScenario()
    {
        var payOff = Outcome(_service.Compare(TypicalRequest), PayoffStrategy.PayOffFirst);
        var year30 = payOff.RiskAdjusted.Years[^1];

        Assert.Multiple(() =>
        {
            Assert.That(payOff.RiskAdjusted.Years, Has.Count.EqualTo(31), "today plus 30 years");
            Assert.That(year30.NetWorth, Is.EqualTo(Typical.PayOffFirst.RiskAdjustedNetWorthAtYear30), "net worth");
            Assert.That(year30.NetWorthInTodaysDollars, Is.EqualTo(Typical.PayOffFirst.RiskAdjustedNetWorthAtYear30InTodaysDollars), "in today's dollars");
            Assert.That(year30.HomeEquity, Is.EqualTo(year30.HomeValue - year30.MortgageBalance), "equity");
            Assert.That(payOff.RiskAdjusted.PayoffDate, Is.EqualTo(Typical.PayOffFirst.PayoffDate), "the payoff date");
            Assert.That(payOff.RiskAdjusted.CrossoverDate, Is.EqualTo(Typical.PayOffFirst.RiskAdjustedCrossoverDate), "the crossover date");
            Assert.That(payOff.BadDecade.Years[^1].NetWorth, Is.EqualTo(Typical.PayOffFirst.BadDecadeNetWorthAtYear30), "the bad decade");
            Assert.That(payOff.Expected.Years[^1].NetWorth, Is.EqualTo(Typical.PayOffFirst.ExpectedNetWorthAtYear30), "the expected return");
        });
    }

    [TestCase(TaxFilingStatus.Single, 16_100)]
    [TestCase(TaxFilingStatus.HeadOfHousehold, 24_150)]
    public void Compare_MapsTheFilingStatus(TaxFilingStatus status, decimal standardDeduction) =>
        Assert.That(_service.Compare(TypicalRequest with { FilingStatus = status }).Rates.StandardDeduction, Is.EqualTo(standardDeduction), "each status has its own deduction");

    [TestCase(InvestorRiskProfile.Conservative, 4)]
    [TestCase(InvestorRiskProfile.Aggressive, 0)]
    public void Compare_MapsTheRiskProfile(InvestorRiskProfile profile, decimal margin) =>
        Assert.That(_service.Compare(TypicalRequest with { RiskProfile = profile }).Rates.RiskMargin, Is.EqualTo(margin), "each profile has its own margin");

    [Test]
    public void Compare_MapsTheStockOptions()
    {
        var response = _service.Compare(TypicalRequest with
        {
            MonthlyCashToPutToWork = 2_000m,
            EsppContributionPercent = 10m,
            AnnualRsuVesting = 30_000m,
            SellRsusAtVest = false,
            AnnualEsopContribution = 5_000m,
        });

        Assert.Multiple(() =>
        {
            Assert.That(response.Plan.EsppContribution, Is.EqualTo(1_000m), "10% of pay into the ESPP");
            Assert.That(response.Rates.EsppGainPercent, Is.EqualTo(17.65m), "a 15% discount");
            Assert.That(response.Rates.AutomaticAnnualStock, Is.EqualTo(35_000m), "RSUs kept and the ESOP");
            Assert.That(response.Rates.HybridInvestPercent, Is.Zero, "plenty of stock already, so the hybrid pays down the mortgage");
        });
    }

    [Test]
    public void Compare_DefaultsTheNextPaymentToTheFirstOfNextMonth()
    {
        var response = _service.Compare(TypicalRequest with { NextPaymentDate = null });

        Assert.That(Outcome(response, PayoffStrategy.PayOffFirst).RiskAdjusted.PayoffDate, Is.EqualTo(TestClock.FirstOfNextMonth.AddMonths(Typical.PayOffFirst.PayoffMonth - 1)),
            "the payoff counts from next month's payment");
    }
}
