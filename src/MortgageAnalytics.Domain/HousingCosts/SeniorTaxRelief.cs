namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// Extra homestead relief for an owner who is 65 or older, or disabled, starting in a given loan year:
/// an additional exemption and, optionally, a tax ceiling.
/// </summary>
/// <remarks>
/// In Texas, school districts must give this relief: an additional $60,000 exemption (since 2025)
/// and a ceiling that freezes the school tax at the amount owed in the first year the owner qualifies.
/// The tax can still fall below the ceiling, for example when values drop, but it can never rise above it.
/// Counties and cities may choose to offer their own extra exemption and ceiling.
/// </remarks>
public sealed record SeniorTaxRelief
{
    /// <summary>Creates relief that applies from loan year <paramref name="startsInYear"/> (0-based) onward.</summary>
    /// <param name="startsInYear">The first loan year (0-based) the owner qualifies. 0 means they qualify at purchase.</param>
    /// <param name="additionalExemption">Dollars of value exempted on top of the regular homestead exemption.</param>
    /// <param name="hasTaxCeiling">True to freeze the tax at the qualifying year's amount.</param>
    /// <exception cref="DomainValidationException">The start year or the exemption is negative.</exception>
    public SeniorTaxRelief(int startsInYear, decimal additionalExemption, bool hasTaxCeiling)
    {
        if (startsInYear < 0)
            throw new DomainValidationException("The qualifying year cannot be negative.");
        if (additionalExemption < 0)
            throw new DomainValidationException("An additional exemption cannot be negative.");

        StartsInYear = startsInYear;
        AdditionalExemption = additionalExemption;
        HasTaxCeiling = hasTaxCeiling;
    }

    /// <summary>The first loan year (0-based) the owner qualifies.</summary>
    public int StartsInYear { get; }

    /// <summary>Dollars of value exempted on top of the regular homestead exemption.</summary>
    public decimal AdditionalExemption { get; }

    /// <summary>True when the tax is frozen at the qualifying year's amount.</summary>
    public bool HasTaxCeiling { get; }

    /// <summary>Returns true when the relief applies in loan year <paramref name="year"/> (0-based).</summary>
    public bool AppliesIn(int year) => year >= StartsInYear;
}
