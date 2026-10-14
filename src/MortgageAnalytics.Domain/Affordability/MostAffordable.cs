namespace MortgageAnalytics.Domain.Affordability;

/// <summary>
/// The highest price a monthly budget reaches. The payment rises with the price, but through taxes after exemptions,
/// mortgage insurance and upfront fees that no formula inverts, so the price is found by search: doubling from a start
/// until the budget is passed, then halving the gap to the whole dollar.
/// </summary>
public static class MostAffordable
{
    /// <summary>The most any search looks: the largest loan the calculator takes.</summary>
    public const decimal DefaultMax = 100_000_000m;

    /// <summary>The highest whole-dollar price whose payment is within <paramref name="budget"/>, or 0 when none is.</summary>
    /// <param name="paymentAt">The monthly payment at a price, or null when no loan can be had at it (it is above a limit).
    /// It must not fall as the price rises.</param>
    /// <param name="budget">The most the payment may be.</param>
    /// <param name="start">A price to start from, such as the home being looked at.</param>
    /// <param name="max">The most the search looks.</param>
    public static decimal Price(Func<decimal, decimal?> paymentAt, decimal budget, decimal start, decimal max = DefaultMax)
    {
        bool Fits(decimal price) => paymentAt(price) is { } payment && payment <= budget;

        var high = Math.Min(Math.Max(1m, Math.Floor(start)), max);
        var low = 0m;
        while (Fits(high))
        {
            if (high == max)
                return max;
            low = high;
            high = Math.Min(high * 2m, max);
        }

        // low fits (or is 0) and high does not: narrow to the last whole dollar that fits.
        while (high - low > 1m)
        {
            var middle = Math.Floor((low + high) / 2m);
            if (Fits(middle))
                low = middle;
            else
                high = middle;
        }
        return low;
    }
}
