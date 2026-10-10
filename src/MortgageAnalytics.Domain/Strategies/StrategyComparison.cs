namespace MortgageAnalytics.Domain.Strategies;

/// <summary>One strategy in every market scenario.</summary>
/// <param name="Kind">Which strategy.</param>
/// <param name="InvestPercent">The share of extra cash it invests while the mortgage is owed.</param>
/// <param name="Expected">At the expected return.</param>
/// <param name="RiskAdjusted">At the risk-adjusted return: what strategies are ranked on.</param>
/// <param name="BadDecade">With a lost decade first.</param>
public sealed record StrategyOutcome(
    StrategyKind Kind,
    decimal InvestPercent,
    StrategyProjection Expected,
    StrategyProjection RiskAdjusted,
    StrategyProjection BadDecade)
{
    /// <summary>The projection for <paramref name="scenario"/>.</summary>
    /// <param name="scenario">The market scenario.</param>
    public StrategyProjection In(MarketScenarioKind scenario) => scenario switch
    {
        MarketScenarioKind.Expected => Expected,
        MarketScenarioKind.RiskAdjusted => RiskAdjusted,
        MarketScenarioKind.BadDecade => BadDecade,
        _ => throw new DomainValidationException($"Unknown market scenario {scenario}."),
    };
}

/// <summary>Every strategy side by side, with the one to recommend.</summary>
/// <param name="Plan">Where each month's cash goes before a strategy chooses.</param>
/// <param name="Rates">The rates behind the comparison.</param>
/// <param name="Outcomes">Pay off first, invest the difference, and the hybrid, in that order.</param>
public sealed record StrategyComparison(MonthlyCashPlan Plan, StrategyRates Rates, IReadOnlyList<StrategyOutcome> Outcomes)
{
    /// <summary>
    /// The strategy with the highest net worth at the end at the risk-adjusted return. The expected return is
    /// never guaranteed, so it is not what the recommendation rests on. A tie goes to the earlier strategy
    /// (paying off first), the one with less risk.
    /// </summary>
    public StrategyOutcome Recommended => WinnerIn(MarketScenarioKind.RiskAdjusted);

    /// <summary>The best of the others at the risk-adjusted return.</summary>
    public StrategyOutcome RunnerUp => Ranked(MarketScenarioKind.RiskAdjusted).Skip(1).First();

    /// <summary>How much more the recommended strategy is worth at the end than the runner-up.</summary>
    public decimal Lead => Recommended.RiskAdjusted.FinalNetWorth - RunnerUp.RiskAdjusted.FinalNetWorth;

    /// <summary><see cref="Lead"/> as a percentage of the runner-up's net worth; null when that is not positive.</summary>
    public decimal? LeadPercent => RunnerUp.RiskAdjusted.FinalNetWorth > 0
        ? Math.Round(Lead / RunnerUp.RiskAdjusted.FinalNetWorth * 100m, 1, MidpointRounding.AwayFromZero)
        : null;

    /// <summary>The strategy with the highest net worth at the end in <paramref name="scenario"/>.</summary>
    /// <param name="scenario">The market scenario.</param>
    public StrategyOutcome WinnerIn(MarketScenarioKind scenario) => Ranked(scenario).First();

    // OrderByDescending is stable, so ties keep the listed order.
    private IEnumerable<StrategyOutcome> Ranked(MarketScenarioKind scenario) =>
        Outcomes.OrderByDescending(o => o.In(scenario).FinalNetWorth);
}
