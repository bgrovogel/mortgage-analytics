namespace MortgageAnalytics.Domain.Strategies;

/// <summary>The three ways of putting extra cash to work that the optimizer compares.</summary>
public enum StrategyKind
{
    /// <summary>"Debt free ASAP": every extra dollar goes to principal; once the mortgage is gone, everything is invested.</summary>
    PayOffFirst = 0,

    /// <summary>"Invest the difference": pay only the required payment and invest every extra dollar.</summary>
    InvestTheDifference = 1,

    /// <summary>A split between the two, set by comparing the guaranteed mortgage rate with a risk-adjusted market return.</summary>
    Hybrid = 2,
}
