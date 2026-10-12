namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// An ad valorem tax: an annual rate on the home's taxable value, collected in twelve monthly
/// installments. Used for school, county/city and MUD taxes, each as its own taxing unit.
/// </summary>
/// <remarks>
/// Each year the tax is recalculated from that year's assessed value (see <see cref="PropertyValuation"/>)
/// minus this unit's <see cref="TaxExemption"/>. The bill therefore follows rising values, but no faster
/// than the assessment cap allows. The rate can change from a given year (a taxing unit adopts a new one each year).
/// With <see cref="SeniorTaxRelief"/>, an extra exemption applies from the qualifying year, and a ceiling can freeze
/// the bill at that year's amount, at that year's rate.
/// <para>Texas quotes rates "per $100 of valuation". A rate of $0.85 per $100 equals 0.85%, so it is entered as-is.</para>
/// </remarks>
public sealed class ValueBasedTax : IHousingCost
{
    private readonly PropertyValuation _valuation;
    private readonly SortedDictionary<int, decimal> _rateChanges;

    /// <summary>Creates a taxing unit.</summary>
    /// <param name="category"><see cref="HousingCostCategory.SchoolTax"/>, <see cref="HousingCostCategory.LocalTax"/>, <see cref="HousingCostCategory.MudTax"/> or <see cref="HousingCostCategory.PropertyTax"/> (all of them as one rate).</param>
    /// <param name="valuation">The home's assessed value, year by year.</param>
    /// <param name="annualRatePercent">The annual rate as a percentage (1.05 means 1.05%).</param>
    /// <param name="exemption">This unit's homestead exemption, or null for none.</param>
    /// <param name="seniorRelief">Over-65 or disability relief this unit grants, or null for none.</param>
    /// <param name="rateChanges">New rates by the 0-based loan year they start in (after the first), each lasting until the next.</param>
    /// <exception cref="DomainValidationException">The category is not a tax, a rate is negative, or a change is not in a later year.</exception>
    public ValueBasedTax(
        HousingCostCategory category,
        PropertyValuation valuation,
        decimal annualRatePercent,
        TaxExemption? exemption = null,
        SeniorTaxRelief? seniorRelief = null,
        IReadOnlyDictionary<int, decimal>? rateChanges = null)
    {
        if (category is not (HousingCostCategory.SchoolTax or HousingCostCategory.LocalTax or HousingCostCategory.MudTax or HousingCostCategory.PropertyTax))
            throw new DomainValidationException("A value-based tax must be a school, property or MUD tax.");
        HousingCostGuard.AgainstNegative(annualRatePercent, nameof(annualRatePercent));
        foreach (var (year, rate) in rateChanges ?? new Dictionary<int, decimal>())
        {
            if (year < 1)
                throw new DomainValidationException("A rate change starts in a later year than the first; the first year's rate is the tax's own.");
            HousingCostGuard.AgainstNegative(rate, "A changed rate");
        }

        Category = category;
        _valuation = valuation;
        AnnualRatePercent = annualRatePercent;
        Exemption = exemption ?? TaxExemption.None;
        SeniorRelief = seniorRelief;
        _rateChanges = new SortedDictionary<int, decimal>(rateChanges?.ToDictionary() ?? []);
    }

    /// <inheritdoc />
    public HousingCostCategory Category { get; }

    /// <summary>The annual rate as a percentage, in the first year.</summary>
    public decimal AnnualRatePercent { get; }

    /// <summary>The rate in force in loan year <paramref name="year"/> (0-based): the latest change by then, or the first rate.</summary>
    public decimal RateInYear(int year) =>
        _rateChanges.LastOrDefault(change => change.Key <= year, new KeyValuePair<int, decimal>(0, AnnualRatePercent)).Value;

    /// <summary>The homestead exemption this unit grants.</summary>
    public TaxExemption Exemption { get; }

    /// <summary>Over-65 or disability relief, or null when there is none.</summary>
    public SeniorTaxRelief? SeniorRelief { get; }

    /// <summary>
    /// Returns the full tax bill for loan year <paramref name="year"/> (0-based), before it is split into
    /// monthly installments. Once senior relief applies, the extra exemption is included, and with a
    /// ceiling the bill never exceeds the qualifying year's bill (at that year's rate), or the share of it a
    /// transferred ceiling keeps.
    /// </summary>
    public decimal AnnualAmountInYear(int year)
    {
        if (SeniorRelief is not { } relief || !relief.AppliesIn(year))
            return TaxBeforeCeiling(year, Exemption);

        var withRelief = Exemption.Plus(relief.AdditionalExemption);
        var tax = TaxBeforeCeiling(year, withRelief);

        return relief.HasTaxCeiling
            ? Math.Min(tax, Money.Round(TaxBeforeCeiling(relief.StartsInYear, withRelief) * relief.CeilingShare))
            : tax;
    }

    /// <summary>
    /// The value this unit taxes in loan year <paramref name="year"/> (0-based): the assessed value minus this
    /// unit's exemptions, including the over-65 exemption from the qualifying year. (A ceiling caps the bill,
    /// not this value.)
    /// </summary>
    /// <param name="year">The 0-based loan year.</param>
    /// <returns>The taxable value, never negative.</returns>
    public decimal TaxableValueInYear(int year)
    {
        var exemption = SeniorRelief is { } relief && relief.AppliesIn(year) ? Exemption.Plus(relief.AdditionalExemption) : Exemption;
        return exemption.TaxableValue(_valuation.AssessedValueInYear(year));
    }

    /// <summary>The tax for <paramref name="year"/> with the given exemption, ignoring any ceiling.</summary>
    private decimal TaxBeforeCeiling(int year, TaxExemption exemption) =>
        Money.Round(exemption.TaxableValue(_valuation.AssessedValueInYear(year)) * RateInYear(year) / 100m);

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) =>
        Installments.MonthlyShare(AnnualAmountInYear(LoanCalendar.YearOf(period.PaymentNumber)), period.PaymentNumber);
}
