using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Closing;

/// <summary>
/// How much of a seller's or builder's offer each use takes. A buydown and points are concessions like credits, so the
/// loan's limit holds them too: VA's leaves out discount points, as it does the normal closing costs.
/// </summary>
public static class SellerOffer
{
    /// <summary>The usual rate cut for each point a lender sells: a quarter of a percentage point.</summary>
    public const decimal DefaultRateCutPerPoint = 0.25m;

    /// <summary>The most rate a point can buy: no lender sells more than a percentage point for one.</summary>
    public const decimal MaxRateCutPerPoint = 1m;

    /// <summary>How long a loan is usually kept before the home is sold or the loan refinanced.</summary>
    public const int DefaultYearsKept = 7;

    /// <summary>
    /// What the seller pays of a temporary buydown's <paramref name="subsidy"/>: the offer, but no more than the subsidy
    /// or the limit. The buyer pays the rest at closing; any of the offer left over goes toward the closing costs.
    /// </summary>
    /// <param name="offer">What the seller or builder offers.</param>
    /// <param name="subsidy">What the buydown costs.</param>
    /// <param name="limit">The most the seller may pay.</param>
    public static decimal BuydownShare(decimal offer, decimal subsidy, ConcessionLimit limit) =>
        Math.Min(Math.Min(offer, subsidy), limit.Amount);

    /// <summary>
    /// The discount points the offer buys: as large a share of the loan as the offer pays within the limit (VA's
    /// leaves points out), in thousandths of a point rounded down, and no more than <see cref="DiscountPoints.MaxPoints"/>.
    /// </summary>
    /// <param name="offer">What the seller or builder offers.</param>
    /// <param name="loanAmount">The amount borrowed, which a point is 1% of.</param>
    /// <param name="limit">The most the seller may pay.</param>
    public static decimal PointsFor(decimal offer, decimal loanAmount, ConcessionLimit limit)
    {
        var budget = limit.ExcludesNormalClosingCosts ? offer : Math.Min(offer, limit.Amount);
        return Math.Min(DiscountPoints.MaxPoints, Math.Floor(budget / loanAmount * 100_000m) / 1_000m);
    }

    /// <summary>The rate with <paramref name="points"/>: lower by <paramref name="cutPerPoint"/> for each, to a thousandth, and never below 0%.</summary>
    /// <param name="rate">The rate without points.</param>
    /// <param name="points">The points bought.</param>
    /// <param name="cutPerPoint">How much each point lowers the rate, in percentage points.</param>
    public static decimal RateWithPoints(decimal rate, decimal points, decimal cutPerPoint) =>
        Math.Max(0m, Math.Round(rate - points * cutPerPoint, 3, MidpointRounding.AwayFromZero));
}
