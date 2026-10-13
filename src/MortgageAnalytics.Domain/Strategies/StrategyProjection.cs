namespace MortgageAnalytics.Domain.Strategies;

/// <summary>Where a strategy stands at the end of one year.</summary>
/// <param name="Year">Years from today; 0 is today.</param>
/// <param name="HomeValue">What the home is worth.</param>
/// <param name="MortgageBalance">What is still owed.</param>
/// <param name="Investments">Every account, after the tax still owed on it.</param>
/// <param name="NetWorth">Home value minus the mortgage, plus investments.</param>
/// <param name="NetWorthInTodaysDollars">The same, shrunk by inflation to what it would buy today.</param>
public sealed record NetWorthYear(
    int Year,
    decimal HomeValue,
    decimal MortgageBalance,
    decimal Investments,
    decimal NetWorth,
    decimal NetWorthInTodaysDollars)
{
    /// <summary>Home value minus the mortgage.</summary>
    public decimal HomeEquity => HomeValue - MortgageBalance;
}

/// <summary>One strategy played out over the whole horizon in one market scenario.</summary>
/// <param name="Scenario">The market path assumed.</param>
/// <param name="Years">Year 0 (today) through the last year.</param>
/// <param name="TotalInterest">Mortgage interest paid over the horizon.</param>
/// <param name="TotalTaxSaved">Tax saved by deducting mortgage interest over the horizon.</param>
/// <param name="PayoffMonth">The month the mortgage is paid off, or null when it is still owed at the end.</param>
/// <param name="PayoffDate">The due date of that month's payment, or null.</param>
/// <param name="CrossoverMonth">
/// The first month the investments (after tax) are worth at least what is owed on the mortgage: 0 when
/// they already are, null when it never happens.
/// </param>
/// <param name="CrossoverDate">The due date of that month's payment, or null when it is today or never.</param>
/// <param name="TotalMortgageInsurance">PMI paid over the horizon.</param>
/// <param name="MortgageInsuranceEndDate">The due date of the last payment with PMI, or null when none had any.</param>
public sealed record StrategyProjection(
    MarketScenario Scenario,
    IReadOnlyList<NetWorthYear> Years,
    decimal TotalInterest,
    decimal TotalTaxSaved,
    int? PayoffMonth,
    DateOnly? PayoffDate,
    int? CrossoverMonth,
    DateOnly? CrossoverDate,
    decimal TotalMortgageInsurance = 0m,
    DateOnly? MortgageInsuranceEndDate = null)
{
    /// <summary>Net worth at the end of the horizon.</summary>
    public decimal FinalNetWorth => Years[^1].NetWorth;
}
