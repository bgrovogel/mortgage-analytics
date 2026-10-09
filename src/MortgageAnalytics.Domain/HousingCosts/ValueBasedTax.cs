namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// An ad valorem tax: an annual rate on the home's taxable value, collected in twelve monthly
/// installments. Used for school, county/city and MUD taxes, each as its own taxing unit.
/// </summary>
/// <remarks>
/// Each year the tax is recalculated from that year's assessed value (see <see cref="PropertyValuation"/>)
/// minus this unit's <see cref="TaxExemption"/>. The bill therefore follows rising values, but no faster
/// than the assessment cap allows.
/// <para>Texas quotes rates "per $100 of valuation". A rate of $0.85 per $100 equals 0.85%, so it is entered as-is.</para>
/// </remarks>
public sealed class ValueBasedTax : IHousingCost
{
    private readonly PropertyValuation _valuation;

    /// <summary>Creates a taxing unit.</summary>
    /// <param name="category"><see cref="HousingCostCategory.SchoolTax"/>, <see cref="HousingCostCategory.PropertyTax"/> or <see cref="HousingCostCategory.MudTax"/>.</param>
    /// <param name="valuation">The home's assessed value, year by year.</param>
    /// <param name="annualRatePercent">The annual rate as a percentage (1.05 means 1.05%).</param>
    /// <param name="exemption">This unit's homestead exemption, or null for none.</param>
    /// <exception cref="DomainValidationException">The category is not a tax, or the rate is negative.</exception>
    public ValueBasedTax(HousingCostCategory category, PropertyValuation valuation, decimal annualRatePercent, TaxExemption? exemption = null)
    {
        if (category is not (HousingCostCategory.SchoolTax or HousingCostCategory.PropertyTax or HousingCostCategory.MudTax))
            throw new DomainValidationException("A value-based tax must be a school, property or MUD tax.");
        HousingCostGuard.AgainstNegative(annualRatePercent, nameof(annualRatePercent));

        Category = category;
        _valuation = valuation;
        AnnualRatePercent = annualRatePercent;
        Exemption = exemption ?? TaxExemption.None;
    }

    /// <inheritdoc />
    public HousingCostCategory Category { get; }

    /// <summary>The annual rate as a percentage.</summary>
    public decimal AnnualRatePercent { get; }

    /// <summary>The homestead exemption this unit grants.</summary>
    public TaxExemption Exemption { get; }

    /// <summary>Returns the full tax bill for loan year <paramref name="year"/> (0-based), before it is split into monthly installments.</summary>
    public decimal AnnualAmountInYear(int year) =>
        Money.Round(Exemption.TaxableValue(_valuation.AssessedValueInYear(year)) * AnnualRatePercent / 100m);

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) =>
        Installments.MonthlyShare(AnnualAmountInYear(PropertyValuation.YearOf(period.PaymentNumber)), period.PaymentNumber);
}
