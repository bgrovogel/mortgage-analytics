namespace MortgageAnalytics.Domain.Affordability;

/// <summary>Shares one monthly payment between buyers, so that the shares add up to the payment exactly.</summary>
public static class PaymentSplit
{
    /// <summary>
    /// Each buyer's share of <paramref name="payment"/> in proportion to what they earn, in whole cents. Cents left
    /// over by the rounding go to the largest remainders, the earliest buyer first on a tie.
    /// </summary>
    /// <param name="payment">The payment to share, to the cent.</param>
    /// <param name="incomes">What each buyer earns, in the same period; at least one above nothing.</param>
    public static IReadOnlyList<decimal> ByIncome(decimal payment, IReadOnlyList<decimal> incomes)
    {
        var total = incomes.Sum();
        if (total <= 0)
            throw new ArgumentException("There is no income to share the payment by.", nameof(incomes));

        var cents = (long)Math.Round(payment * 100m, MidpointRounding.AwayFromZero);
        var exact = incomes.Select(income => cents * income / total).ToList();
        var shares = exact.Select(share => (long)Math.Floor(share)).ToList();

        var left = cents - shares.Sum();
        foreach (var i in Enumerable.Range(0, shares.Count).OrderByDescending(i => exact[i] - shares[i]).ThenBy(i => i).Take((int)left))
            shares[i]++;

        return shares.Select(share => share / 100m).ToList();
    }
}
