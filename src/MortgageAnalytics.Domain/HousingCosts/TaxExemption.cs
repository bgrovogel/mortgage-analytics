namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// A homestead exemption: the part of the home's value a taxing unit does not tax.
/// </summary>
/// <remarks>
/// A unit can grant a percentage of the value, a fixed dollar amount, or both. The percentage is
/// taken first. In Texas, school districts must exempt $140,000 of a homestead's value, and counties
/// and cities may choose to exempt up to 20%.
/// </remarks>
public sealed record TaxExemption
{
    /// <summary>Creates an exemption.</summary>
    /// <param name="amount">Dollars of value exempted (140,000 for a Texas school district).</param>
    /// <param name="percent">Percentage of value exempted (0 to 100).</param>
    /// <exception cref="DomainValidationException">The amount is negative or the percentage is outside 0 to 100.</exception>
    public TaxExemption(decimal amount = 0m, decimal percent = 0m)
    {
        if (amount < 0)
            throw new DomainValidationException("An exemption amount cannot be negative.");
        if (percent is < 0 or > 100)
            throw new DomainValidationException("An exemption percentage must be between 0 and 100.");

        Amount = amount;
        Percent = percent;
    }

    /// <summary>No exemption: the full assessed value is taxed.</summary>
    public static TaxExemption None { get; } = new();

    /// <summary>Dollars of value exempted.</summary>
    public decimal Amount { get; }

    /// <summary>Percentage of value exempted.</summary>
    public decimal Percent { get; }

    /// <summary>Returns a copy with <paramref name="additionalAmount"/> more dollars exempted, for stacking extra relief.</summary>
    public TaxExemption Plus(decimal additionalAmount) => new(Amount + additionalAmount, Percent);

    /// <summary>Returns the value left to tax after the exemption. It is never negative.</summary>
    /// <param name="assessedValue">The home's assessed value for the year.</param>
    public decimal TaxableValue(decimal assessedValue) =>
        Math.Max(0m, Money.Round(assessedValue * (1 - Percent / 100m)) - Amount);
}
