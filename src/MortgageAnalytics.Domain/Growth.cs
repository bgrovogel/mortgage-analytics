namespace MortgageAnalytics.Domain;

/// <summary>Compound annual growth, used for home values, insurance premiums and dues.</summary>
public static class Growth
{
    /// <summary>Grows <paramref name="amount"/> by <paramref name="annualPercent"/> a year for <paramref name="years"/> years.</summary>
    /// <param name="amount">The starting amount.</param>
    /// <param name="annualPercent">Yearly change as a percentage. 3 means +3%; negative values shrink the amount.</param>
    /// <param name="years">Whole years of growth. Zero returns the amount unchanged.</param>
    /// <returns>The grown amount, rounded to cents.</returns>
    public static decimal Compound(decimal amount, decimal annualPercent, int years) =>
        annualPercent == 0 || years == 0
            ? amount
            : Money.Round(amount * DecimalMath.Pow(1 + annualPercent / 100m, years));
}
