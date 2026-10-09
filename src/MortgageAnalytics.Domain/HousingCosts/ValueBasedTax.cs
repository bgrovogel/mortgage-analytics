namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// An ad valorem tax: an annual rate applied to the home's assessed value and collected
/// in twelve equal monthly installments. Used for both property tax and MUD tax.
/// </summary>
/// <remarks>
/// Texas quotes rates "per $100 of valuation". A rate of $0.85 per $100 is the same as 0.85%,
/// so the number can be entered as-is.
/// </remarks>
public sealed class ValueBasedTax : IHousingCost
{
    private readonly decimal _monthlyAmount;

    /// <summary>Creates a tax charged at <paramref name="annualRatePercent"/> of <paramref name="assessedValue"/> per year.</summary>
    /// <param name="category">Either <see cref="HousingCostCategory.PropertyTax"/> or <see cref="HousingCostCategory.MudTax"/>.</param>
    /// <param name="assessedValue">The taxable value of the home, in dollars.</param>
    /// <param name="annualRatePercent">The annual rate as a percentage (2.1 means 2.1%).</param>
    /// <exception cref="DomainValidationException">The category is not a tax, or a value is negative.</exception>
    public ValueBasedTax(HousingCostCategory category, decimal assessedValue, decimal annualRatePercent)
    {
        if (category is not (HousingCostCategory.PropertyTax or HousingCostCategory.MudTax))
            throw new DomainValidationException("A value-based tax must be a property tax or a MUD tax.");
        HousingCostGuard.AgainstNegative(assessedValue, nameof(assessedValue));
        HousingCostGuard.AgainstNegative(annualRatePercent, nameof(annualRatePercent));

        Category = category;
        AnnualAmount = Money.Round(assessedValue * annualRatePercent / 100m);
        _monthlyAmount = Money.Round(AnnualAmount / 12m);
    }

    /// <inheritdoc />
    public HousingCostCategory Category { get; }

    /// <summary>The full tax bill for one year, before it is split into monthly installments.</summary>
    public decimal AnnualAmount { get; }

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) => _monthlyAmount;
}
