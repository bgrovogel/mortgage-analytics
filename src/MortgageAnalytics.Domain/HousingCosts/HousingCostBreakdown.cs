namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>An immutable set of amounts by <see cref="HousingCostCategory"/>, for one month or a lifetime total.</summary>
public sealed class HousingCostBreakdown
{
    private readonly Dictionary<HousingCostCategory, decimal> _amounts;

    private HousingCostBreakdown(Dictionary<HousingCostCategory, decimal> amounts)
    {
        _amounts = amounts;
        Total = amounts.Values.Sum();
    }

    /// <summary>A breakdown with nothing in it.</summary>
    public static HousingCostBreakdown Empty { get; } = new([]);

    /// <summary>The sum of every category.</summary>
    public decimal Total { get; }

    /// <summary>Returns the amount for <paramref name="category"/>, or zero if there is none.</summary>
    public decimal this[HousingCostCategory category] => _amounts.GetValueOrDefault(category);

    /// <summary>Totals each cost in <paramref name="costs"/> by category for a single period.</summary>
    /// <param name="costs">The costs to evaluate.</param>
    /// <param name="period">The period to evaluate them for.</param>
    public static HousingCostBreakdown For(IEnumerable<IHousingCost> costs, CostPeriod period) =>
        Combine(costs.Select(c => (c.Category, c.AmountFor(period))));

    /// <summary>The same breakdown with <paramref name="category"/> set to <paramref name="amount"/>; this one is unchanged.</summary>
    /// <param name="category">The category to replace.</param>
    /// <param name="amount">Its new amount.</param>
    public HousingCostBreakdown With(HousingCostCategory category, decimal amount) =>
        new(new Dictionary<HousingCostCategory, decimal>(_amounts) { [category] = amount });

    /// <summary>Adds breakdowns together category by category, for example to total a whole schedule.</summary>
    public static HousingCostBreakdown Sum(IEnumerable<HousingCostBreakdown> breakdowns) =>
        Combine(breakdowns.SelectMany(b => b._amounts.Select(a => (a.Key, a.Value))));

    private static HousingCostBreakdown Combine(IEnumerable<(HousingCostCategory Category, decimal Amount)> items)
    {
        var amounts = new Dictionary<HousingCostCategory, decimal>();
        foreach (var (category, amount) in items)
            amounts[category] = amounts.GetValueOrDefault(category) + amount;
        return new HousingCostBreakdown(amounts);
    }
}
