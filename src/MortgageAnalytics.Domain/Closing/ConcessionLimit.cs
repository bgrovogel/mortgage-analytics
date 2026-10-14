using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Closing;

/// <summary>
/// The most a seller, builder or other party to the sale may pay toward the buyer's closing costs, prepaids, discount
/// points and buydowns (Fannie Mae's "interested party contributions"), as a percentage of the price. A conventional
/// loan's depends on the loan-to-value (Selling Guide B3-4.1-02, for a home lived in or a second home): 3% above 90%,
/// 6% from 75.01% to 90%, 9% at 75% or less. FHA's is 6% (HUD Handbook 4000.1 II.A.4). VA's is 4%, and the seller may pay the buyer's normal
/// closing costs and discount points besides. More than the limit cannot pay the buyer's costs: lenders take it off
/// the price instead.
/// </summary>
/// <param name="Program">The loan's program, whose rule this is.</param>
/// <param name="Percent">The limit, as a percentage of the price.</param>
/// <param name="Amount">The limit in dollars, to the cent.</param>
/// <param name="NextTier">For a conventional loan, the down payment that would raise the limit, and to what; otherwise null.</param>
public sealed record ConcessionLimit(LoanProgram Program, decimal Percent, decimal Amount, ConcessionTier? NextTier)
{
    /// <summary>The conventional tiers, highest loan-to-value first: above the ratio, the percentage applies.</summary>
    private static readonly (decimal AboveLoanToValue, decimal Percent)[] ConventionalTiers = [(0.90m, 3m), (0.75m, 6m), (0m, 9m)];

    /// <summary>True for VA, whose limit leaves out the buyer's normal closing costs and discount points.</summary>
    public bool ExcludesNormalClosingCosts => Program == LoanProgram.Va;

    /// <summary>The limit on <paramref name="purchase"/> with a loan from <paramref name="program"/>.</summary>
    /// <param name="program">Conventional, FHA or VA.</param>
    /// <param name="purchase">The price, which the limit is a percentage of, and the down payment.</param>
    public static ConcessionLimit For(LoanProgram program, PropertyPurchase purchase)
    {
        decimal AmountAt(decimal percent) => Money.Round(purchase.HomePrice * percent / 100m);

        if (program != LoanProgram.Conventional)
        {
            var percent = program == LoanProgram.Fha ? 6m : 4m;
            return new ConcessionLimit(program, percent, AmountAt(percent), null);
        }

        var loanToValue = purchase.LoanAmount / purchase.HomePrice;
        var tier = Array.FindIndex(ConventionalTiers, t => loanToValue > t.AboveLoanToValue);
        var current = ConventionalTiers[tier].Percent;
        if (tier == ConventionalTiers.Length - 1)
            return new ConcessionLimit(program, current, AmountAt(current), null);

        // The next tier starts at a loan of exactly this tier's floor: the down payment that leaves it, rounded up to the cent.
        var (floor, next) = (ConventionalTiers[tier].AboveLoanToValue, ConventionalTiers[tier + 1].Percent);
        var downPayment = Math.Ceiling(purchase.HomePrice * (1m - floor) * 100m) / 100m;
        return new ConcessionLimit(program, current, AmountAt(current), new ConcessionTier(downPayment, next, AmountAt(next)));
    }
}

/// <summary>A higher conventional limit, and the down payment that reaches it.</summary>
/// <param name="DownPayment">The least down payment for it, to the cent.</param>
/// <param name="Percent">Its limit, as a percentage of the price.</param>
/// <param name="Amount">Its limit in dollars.</param>
public sealed record ConcessionTier(decimal DownPayment, decimal Percent, decimal Amount);
