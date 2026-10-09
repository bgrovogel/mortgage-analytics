namespace MortgageAnalytics.Domain.ExtraPayments;

/// <summary>
/// An extra amount paid once a year (a tax refund or bonus, say): first on
/// <see cref="FirstPaymentNumber"/>, then every 12 payments after it.
/// </summary>
public sealed class AnnualExtraPayment : IExtraPaymentRule
{
    private const int PaymentsPerYear = 12;

    /// <summary>Creates a once-a-year prepayment.</summary>
    /// <param name="amount">The extra principal paid each year.</param>
    /// <param name="firstPaymentNumber">The payment that carries the first annual extra. Defaults to the 12th.</param>
    /// <exception cref="DomainValidationException">The amount is negative or the first payment is below 1.</exception>
    public AnnualExtraPayment(decimal amount, int firstPaymentNumber = PaymentsPerYear)
    {
        ExtraPaymentGuard.AgainstInvalid(amount, firstPaymentNumber);
        Amount = amount;
        FirstPaymentNumber = firstPaymentNumber;
    }

    /// <summary>The extra principal paid each year.</summary>
    public decimal Amount { get; }

    /// <summary>The payment that carries the first annual extra.</summary>
    public int FirstPaymentNumber { get; }

    /// <inheritdoc />
    public decimal AmountFor(int paymentNumber) =>
        paymentNumber >= FirstPaymentNumber && (paymentNumber - FirstPaymentNumber) % PaymentsPerYear == 0
            ? Amount
            : 0m;
}
