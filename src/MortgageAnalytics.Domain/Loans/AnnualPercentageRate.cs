namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// The annual percentage rate: the yearly cost of a loan counting the charges paid up front, so offers with different
/// fees can be compared. It is the rate at which the payments, each discounted by a month's interest, add up to what
/// the borrower actually received (Regulation Z's actuarial method with a monthly unit period): the loan less its
/// prepaid finance charges.
/// </summary>
public static class AnnualPercentageRate
{
    /// <summary>The highest monthly rate searched: 100%, far beyond any loan, so the search always brackets the answer.</summary>
    private const decimal HighestMonthlyRate = 1m;

    /// <summary>Rounded to a thousandth of a percent, finer than the eighth of a point Regulation Z asks for.</summary>
    private const int Places = 3;

    /// <summary>The APR as a percentage, or null when there is no rate to speak of.</summary>
    /// <param name="amountFinanced">What the borrower received: the loan less its prepaid finance charges.</param>
    /// <param name="payments">Each payment, the first at the end of the first month. Include mortgage insurance.</param>
    /// <returns>Null when nothing was received, or the payments return less than was received.</returns>
    public static decimal? Of(decimal amountFinanced, IReadOnlyList<decimal> payments)
    {
        if (amountFinanced <= 0m || payments.Count == 0)
            return null;

        var total = payments.Sum();
        if (total < amountFinanced)
            return null;
        if (total == amountFinanced)
            return 0m;

        // The payments' present value falls as the rate rises: bisect for the rate where it equals what was received.
        var (low, high) = (0m, HighestMonthlyRate);
        for (var step = 0; step < 100; step++)
        {
            var middle = (low + high) / 2m;
            if (PresentValue(payments, middle) > amountFinanced)
                low = middle;
            else
                high = middle;
        }

        return Math.Round((low + high) / 2m * 12m * 100m, Places, MidpointRounding.AwayFromZero);
    }

    private static decimal PresentValue(IReadOnlyList<decimal> payments, decimal monthlyRate)
    {
        var discount = 1m / (1m + monthlyRate);
        var factor = 1m;
        var value = 0m;
        foreach (var payment in payments)
        {
            factor *= discount;
            value += payment * factor;
        }
        return value;
    }
}
