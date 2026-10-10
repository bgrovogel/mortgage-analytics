namespace MortgageAnalytics.Domain.Strategies;

/// <summary>Compares paying the mortgage off first, investing the difference, and a hybrid.</summary>
public interface IStrategyOptimizer
{
    /// <summary>Plays every strategy out in every market scenario and ranks them.</summary>
    /// <param name="inputs">The mortgage, household and market.</param>
    /// <returns>The strategies side by side, and the one to recommend.</returns>
    StrategyComparison Compare(StrategyInputs inputs);
}

/// <summary>
/// Runs each strategy through three market paths: the expected return, a risk-adjusted return (expected
/// minus the risk profile's margin), and a lost decade followed by the risk-adjusted return. Paying down the
/// mortgage earns its rate whatever the market does; investing does not, which is why the ranking uses
/// the risk-adjusted path and the bad decade is always shown. Stateless, so one instance can be shared.
/// </summary>
/// <param name="simulator">Plays out one strategy in one scenario.</param>
public sealed class StrategyOptimizer(IStrategySimulator simulator) : IStrategyOptimizer
{
    /// <inheritdoc />
    public StrategyComparison Compare(StrategyInputs inputs)
    {
        var plan = MonthlyCashPlan.For(inputs);
        var rates = StrategyRates.For(inputs, plan);
        var expected = MarketScenario.Steady(MarketScenarioKind.Expected, rates.ExpectedReturn);
        var riskAdjusted = MarketScenario.Steady(MarketScenarioKind.RiskAdjusted, rates.RiskAdjustedReturn);
        var badDecade = MarketScenario.BadDecadeThen(rates.RiskAdjustedReturn);

        StrategyOutcome Play(StrategyKind kind, decimal investPercent) => new(
            kind,
            investPercent,
            simulator.Simulate(inputs, investPercent, expected),
            simulator.Simulate(inputs, investPercent, riskAdjusted),
            simulator.Simulate(inputs, investPercent, badDecade));

        return new StrategyComparison(plan, rates,
        [
            Play(StrategyKind.PayOffFirst, 0m),
            Play(StrategyKind.InvestTheDifference, 100m),
            Play(StrategyKind.Hybrid, rates.HybridInvestPercent),
        ]);
    }
}
