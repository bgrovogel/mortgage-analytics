namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>A flat monthly charge that can rise by a set percentage each year, such as HOA dues.</summary>
public sealed class MonthlyFixedCost : IHousingCost
{
    /// <summary>Creates a cost of <paramref name="monthlyAmount"/> per month in the first year.</summary>
    /// <param name="category">The category to report the cost under.</param>
    /// <param name="monthlyAmount">The first year's monthly amount in dollars.</param>
    /// <param name="annualIncreasePercent">How much the amount rises each year, as a percentage (3 means +3%).</param>
    /// <exception cref="DomainValidationException">The amount is negative or the increase is -100% or less.</exception>
    public MonthlyFixedCost(HousingCostCategory category, decimal monthlyAmount, decimal annualIncreasePercent = 0m)
    {
        HousingCostGuard.AgainstNegative(monthlyAmount, nameof(monthlyAmount));
        HousingCostGuard.AgainstInvalidGrowth(annualIncreasePercent);

        Category = category;
        MonthlyAmount = Money.Round(monthlyAmount);
        AnnualIncreasePercent = annualIncreasePercent;
    }

    /// <inheritdoc />
    public HousingCostCategory Category { get; }

    /// <summary>The monthly amount in the first year.</summary>
    public decimal MonthlyAmount { get; }

    /// <summary>How much the amount rises each year, as a percentage.</summary>
    public decimal AnnualIncreasePercent { get; }

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) =>
        Growth.Compound(MonthlyAmount, AnnualIncreasePercent, LoanCalendar.YearOf(period.PaymentNumber));
}
