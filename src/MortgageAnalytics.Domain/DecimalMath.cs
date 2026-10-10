namespace MortgageAnalytics.Domain;

/// <summary>
/// Exact arithmetic in <see cref="decimal"/>. <see cref="Math.Pow"/> works in <see cref="double"/>
/// and would introduce binary floating-point error into money calculations.
/// </summary>
internal static class DecimalMath
{
    /// <summary>Raises <paramref name="value"/> to a whole-number power by repeated squaring, in O(log n) multiplications.</summary>
    public static decimal Pow(decimal value, int exponent)
    {
        var result = 1m;
        while (exponent > 0)
        {
            if ((exponent & 1) == 1)
                result *= value;
            value *= value;
            exponent >>= 1;
        }
        return result;
    }
}
