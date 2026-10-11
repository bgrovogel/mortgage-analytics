using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Mapping;

/// <summary>Maps the rate options every loan can have (an adjustable rate, a buydown) the same way on every page.</summary>
public static class RateOptionMapper
{
    /// <summary>An adjustable rate as a domain value (at its worst case if asked), or null for a fixed rate.</summary>
    /// <param name="arm">The request's adjustable rate, if any.</param>
    /// <param name="startingRate">The rate it starts at, for the worst case.</param>
    /// <param name="worstCase">True to take it at the worst its caps allow.</param>
    public static AdjustableRate? ToDomain(this AdjustableRateRequest? arm, decimal startingRate = 0m, bool worstCase = false)
    {
        if (arm is null) return null;
        var rate = new AdjustableRate(arm.InitialFixedMonths, arm.AdjustmentIntervalMonths, arm.ExpectedRate, arm.InitialCap, arm.PeriodicCap, arm.LifetimeCap)
        {
            Margin = arm.Margin,
        };
        return worstCase ? rate.WorstCase(startingRate) : rate;
    }

    /// <summary>A temporary buydown as a domain value, or null for none.</summary>
    /// <param name="buydown">The request's buydown, if any.</param>
    public static TemporaryBuydown? ToDomain(this TemporaryBuydownRequest? buydown) =>
        buydown is null ? null : new TemporaryBuydown(buydown.YearlyReductions);
}
