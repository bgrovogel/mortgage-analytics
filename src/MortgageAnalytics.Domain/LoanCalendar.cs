namespace MortgageAnalytics.Domain;

/// <summary>
/// How monthly payments group into loan years. Payments 1 to 12 are loan year 0, 13 to 24 year 1,
/// and so on. Yearly costs, increases and valuations all use this one definition.
/// </summary>
public static class LoanCalendar
{
    /// <summary>Monthly payments in a loan year.</summary>
    public const int PaymentsPerYear = 12;

    /// <summary>Returns the loan year (0-based) that payment <paramref name="paymentNumber"/> falls in.</summary>
    public static int YearOf(int paymentNumber) => (paymentNumber - 1) / PaymentsPerYear;

    /// <summary>Returns true for the twelfth payment of a loan year (12, 24, 36, ...).</summary>
    public static bool IsLastPaymentOfYear(int paymentNumber) => paymentNumber % PaymentsPerYear == 0;
}
