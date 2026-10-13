using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Strategies;

/// <summary>Everything the optimizer needs: the mortgage and home, the household, its investment options, and the market.</summary>
public sealed record StrategyInputs
{
    /// <summary>Creates the inputs, rejecting any value outside the supported range.</summary>
    /// <param name="mortgage">The mortgage as it stands today: balance, rate, payments left and next due date.</param>
    /// <param name="homeValue">What the home is worth today.</param>
    /// <param name="homeGrowthRate">How much the home's value changes a year, as a percentage.</param>
    /// <param name="household">Income, taxes, cash to put to work and current savings.</param>
    /// <param name="match">The employer's 401(k) match, or <see cref="EmployerMatch.None"/>.</param>
    /// <param name="stockPurchasePlan">The employee stock purchase plan, or <see cref="StockPurchasePlan.None"/>.</param>
    /// <param name="annualIraContribution">How much invested cash goes into an IRA each year before a taxable account.</param>
    /// <param name="market">The market assumptions.</param>
    /// <exception cref="DomainValidationException">A value is out of range.</exception>
    public StrategyInputs(
        LoanTerms mortgage,
        decimal homeValue,
        decimal homeGrowthRate,
        Household household,
        EmployerMatch match,
        StockPurchasePlan stockPurchasePlan,
        decimal annualIraContribution,
        MarketAssumptions market)
    {
        if (homeValue is < 0 or > Household.MaxAmount)
            throw new DomainValidationException($"Home value must be between 0 and {Household.MaxAmount:N0}.");
        if (homeGrowthRate is < -20 or > 25)
            throw new DomainValidationException("Home value growth must be between -20% and 25% a year.");
        if (annualIraContribution is < 0 or > TaxLimits.IraContribution)
            throw new DomainValidationException($"IRA contributions must be between 0 and {TaxLimits.IraContribution:N0} a year.");

        Mortgage = mortgage;
        HomeValue = homeValue;
        HomeGrowthRate = homeGrowthRate;
        Household = household;
        Match = match;
        StockPurchasePlan = stockPurchasePlan;
        AnnualIraContribution = annualIraContribution;
        Market = market;
    }

    /// <summary>The mortgage as it stands today.</summary>
    public LoanTerms Mortgage { get; }

    /// <summary>What the home is worth today.</summary>
    public decimal HomeValue { get; }

    /// <summary>How much the home's value changes a year, as a percentage.</summary>
    public decimal HomeGrowthRate { get; }

    /// <summary>Income, taxes, cash to put to work and current savings.</summary>
    public Household Household { get; }

    /// <summary>The employer's 401(k) match.</summary>
    public EmployerMatch Match { get; }

    /// <summary>The employee stock purchase plan.</summary>
    public StockPurchasePlan StockPurchasePlan { get; }

    /// <summary>How much invested cash goes into an IRA each year before a taxable account.</summary>
    public decimal AnnualIraContribution { get; }

    /// <summary>The market assumptions.</summary>
    public MarketAssumptions Market { get; }

    /// <summary>
    /// A temporary buydown on the mortgage, starting with its first payment (a new loan), or null. Its subsidy,
    /// usually paid by the seller or builder, pays part of the payment in its years.
    /// </summary>
    public TemporaryBuydown? Buydown { get; init; }

    /// <summary>
    /// PMI on the mortgage, or <see cref="LoanPmi.None"/>. It is part of what the household pays each month until the
    /// balance reaches 80% of the home's value, so paying down ends it sooner: a return investing does not earn.
    /// </summary>
    public LoanPmi Pmi { get; init; } = LoanPmi.None;
}
