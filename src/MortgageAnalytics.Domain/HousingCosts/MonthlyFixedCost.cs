namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>A flat amount charged every month, such as HOA dues.</summary>
public sealed class MonthlyFixedCost : IHousingCost
{
    /// <summary>Creates a cost of <paramref name="monthlyAmount"/> per month.</summary>
    /// <param name="category">The category to report the cost under.</param>
    /// <param name="monthlyAmount">The monthly amount in dollars.</param>
    /// <exception cref="DomainValidationException">The amount is negative.</exception>
    public MonthlyFixedCost(HousingCostCategory category, decimal monthlyAmount)
    {
        HousingCostGuard.AgainstNegative(monthlyAmount, nameof(monthlyAmount));
        Category = category;
        MonthlyAmount = Money.Round(monthlyAmount);
    }

    /// <inheritdoc />
    public HousingCostCategory Category { get; }

    /// <summary>The amount charged each month.</summary>
    public decimal MonthlyAmount { get; }

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) => MonthlyAmount;
}
