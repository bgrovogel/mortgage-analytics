namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>Splits a yearly bill into twelve monthly installments that add up to the bill exactly.</summary>
internal static class Installments
{
    private const int PerYear = 12;

    /// <summary>
    /// Returns the installment of <paramref name="annualAmount"/> due with payment <paramref name="paymentNumber"/>.
    /// The first eleven installments are the rounded twelfth; the twelfth takes whatever is left,
    /// so $5,000.00 becomes 11 × $416.67 + $416.63, never $5,000.04.
    /// </summary>
    public static decimal MonthlyShare(decimal annualAmount, int paymentNumber)
    {
        var installment = Money.Round(annualAmount / PerYear);
        var isLastOfYear = (paymentNumber - 1) % PerYear == PerYear - 1;
        return isLastOfYear ? annualAmount - installment * (PerYear - 1) : installment;
    }
}
