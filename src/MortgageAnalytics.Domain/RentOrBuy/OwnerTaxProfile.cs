using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Domain.RentOrBuy;

/// <summary>
/// How an owner's federal income tax differs from a renter's: the owner may itemize the mortgage interest and the property
/// tax, and does when that beats the standard deduction. The saving in a year is the tax rate times how much more the
/// owner deducts than the same person would as a renter (the standard deduction, or their other deductions when those
/// are larger). Figures are for 2026; the standard deduction and the person's other amounts are held to rise with prices,
/// at <see cref="DeductionIndexPercent"/> a year, while the limit on state and local taxes is held at its 2026 amount.
/// </summary>
/// <param name="FilingStatus">How the household files, which sets its standard deduction.</param>
/// <param name="MarginalTaxRatePercent">The federal rate on the last dollars of income, as a percentage.</param>
/// <param name="OtherStateAndLocalTaxes">State income (or sales) and other local taxes paid a year besides this home's property tax, in today's dollars.</param>
/// <param name="OtherItemizedDeductions">Charity and other itemized deductions a year, in today's dollars.</param>
public sealed record OwnerTaxProfile(FilingStatus FilingStatus, decimal MarginalTaxRatePercent, decimal OtherStateAndLocalTaxes, decimal OtherItemizedDeductions)
{
    /// <summary>The most state and local taxes (income, sales and property) that can be deducted in a year, for 2026 (IRC 164(b)(7) as amended in 2025).</summary>
    public const decimal StateAndLocalTaxLimit = 40_400m;

    /// <summary>How fast prices, and with them the standard deduction and a person's other deductions, are taken to rise a year, as a percentage.</summary>
    public const decimal DeductionIndexPercent = 2.5m;

    /// <summary>The most a marginal federal tax rate can be, as a percentage.</summary>
    public const decimal MaxRate = 50m;

    /// <summary>Checks the profile is one a person could have.</summary>
    /// <exception cref="DomainValidationException">The rate is outside 0 to 50%, or an amount is negative.</exception>
    public OwnerTaxProfile Validated()
    {
        if (MarginalTaxRatePercent is < 0 or > MaxRate)
            throw new DomainValidationException($"The tax rate must be between 0% and {MaxRate}%.");
        if (OtherStateAndLocalTaxes < 0)
            throw new DomainValidationException("State and local taxes cannot be negative.");
        if (OtherItemizedDeductions < 0)
            throw new DomainValidationException("Itemized deductions cannot be negative.");
        return this;
    }

    /// <summary>The tax owning saves in <paramref name="year"/> over renting.</summary>
    /// <param name="year">The 1-based year.</param>
    /// <param name="deductibleInterest">The mortgage interest that can be deducted in the year (see <see cref="TaxDeductions.DeductibleInterest"/>).</param>
    /// <param name="propertyTax">The property tax paid in the year, every taxing unit's together.</param>
    /// <returns>The saving, never negative.</returns>
    public decimal TaxSavedByOwning(int year, decimal deductibleInterest, decimal propertyTax)
    {
        var standard = Money.Round(Growth.Compound(TaxDeductions.StandardDeduction(FilingStatus), DeductionIndexPercent, year - 1));
        var otherTaxes = Money.Round(Growth.Compound(OtherStateAndLocalTaxes, DeductionIndexPercent, year - 1));
        var other = Money.Round(Growth.Compound(OtherItemizedDeductions, DeductionIndexPercent, year - 1));

        var renting = Math.Max(standard, other + Math.Min(otherTaxes, StateAndLocalTaxLimit));
        var owning = Math.Max(standard, other + Math.Min(otherTaxes + propertyTax, StateAndLocalTaxLimit) + deductibleInterest);
        return Money.Round((owning - renting) * MarginalTaxRatePercent / 100m);
    }
}
