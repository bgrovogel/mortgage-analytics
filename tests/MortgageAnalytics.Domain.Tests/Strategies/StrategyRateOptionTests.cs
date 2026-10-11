using MortgageAnalytics.Domain.Strategies;
using MortgageAnalytics.Testing;
using static MortgageAnalytics.Testing.ReferenceStrategies;

namespace MortgageAnalytics.Domain.Tests.Strategies;

/// <summary>
/// Pay off or invest with an adjustable rate and with a temporary buydown, against the independent model in
/// tools/strategy-check/strategy_model.py (which takes the rate rules from tools/rate-check/rate_model.py).
/// </summary>
[TestFixture]
public class StrategyRateOptionTests
{
    private readonly StrategyOptimizer _optimizer = new(new StrategySimulator());

    private static StrategyOutcome Outcome(StrategyComparison comparison, StrategyKind kind) => comparison.Outcomes.Single(o => o.Kind == kind);

    [Test]
    public void AnArm_PaysTheRateItResetsTo_AndPayingDownEarnsItsAverage()
    {
        var comparison = _optimizer.Compare(ArmInputs());
        var payOff = Outcome(comparison, StrategyKind.PayOffFirst);
        var invest = Outcome(comparison, StrategyKind.InvestTheDifference);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Rates.MortgageRate, Is.EqualTo(6.5m), "today's rate");
            Assert.That(comparison.Rates.AverageMortgageRate, Is.EqualTo(Arm.AverageMortgageRate), "5 years at 6.5%, then 8.5%");
            Assert.That(comparison.Rates.AfterTaxMortgageRate, Is.EqualTo(Arm.AverageMortgageRate), "not deducted: paying down earns the average");
            Assert.That(comparison.Rates.FirstYearInterest, Is.EqualTo(Arm.FirstYearInterest), "the first year is all at 6.5%");
            Assert.That(comparison.Rates.HybridInvestPercent, Is.EqualTo(Arm.HybridInvestPercent), "the higher rate tilts the hybrid to the mortgage");
            Assert.That(payOff.RiskAdjusted.FinalNetWorth, Is.EqualTo(Arm.PayOffFirstRiskAdjustedNetWorthAtYear30), "paying off first");
            Assert.That(payOff.RiskAdjusted.PayoffMonth, Is.EqualTo(Arm.PayOffFirstPayoffMonth), "and when it is paid off");
            Assert.That(invest.RiskAdjusted.FinalNetWorth, Is.EqualTo(Arm.InvestRiskAdjustedNetWorthAtYear30), "investing");
            Assert.That(invest.RiskAdjusted.TotalInterest, Is.EqualTo(Arm.InvestTotalInterest), "interest at 8.5% after the reset");
            Assert.That(comparison.Recommended.Kind, Is.EqualTo(StrategyKind.PayOffFirst), "an 8.1% guaranteed return beats 8% counted on");
        });
    }

    [Test]
    public void ABuydown_FreesCashForItsYears_InEveryStrategy()
    {
        var comparison = _optimizer.Compare(BuydownInputs());

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Rates.BuydownSubsidy, Is.EqualTo(Buydown.Subsidy), "what the seller's subsidy pays");
            Assert.That(comparison.Rates.AverageMortgageRate, Is.EqualTo(6.5m), "the loan itself stays at its note rate");
            Assert.That(Outcome(comparison, StrategyKind.InvestTheDifference).RiskAdjusted.FinalNetWorth, Is.EqualTo(Buydown.InvestRiskAdjustedNetWorthAtYear30), "investing");
            Assert.That(Outcome(comparison, StrategyKind.PayOffFirst).RiskAdjusted.FinalNetWorth, Is.EqualTo(Buydown.PayOffFirstRiskAdjustedNetWorthAtYear30), "paying off first");
            Assert.That(Outcome(comparison, StrategyKind.PayOffFirst).RiskAdjusted.PayoffMonth, Is.EqualTo(Buydown.PayOffFirstPayoffMonth), "and when");
        });
    }

    [Test]
    public void AFixedRate_HasNoSubsidy_AndItsAverageIsItsRate()
    {
        var rates = _optimizer.Compare(TypicalInputs()).Rates;

        Assert.Multiple(() =>
        {
            Assert.That(rates.AverageMortgageRate, Is.EqualTo(rates.MortgageRate), "a fixed rate averages to itself");
            Assert.That(rates.BuydownSubsidy, Is.Zero, "no buydown");
        });
    }
}
