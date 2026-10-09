namespace MortgageAnalytics.Domain.ExtraPayments;

/// <summary>A one-time extra principal payment made alongside payment <see cref="PaymentNumber"/>.</summary>
public sealed class LumpSumExtraPayment : IExtraPaymentRule
{
    /// <summary>Creates a one-time prepayment.</summary>
    /// <param name="amount">The extra principal paid.</param>
    /// <param name="paymentNumber">The payment the lump sum is made with.</param>
    /// <exception cref="DomainValidationException">The amount is negative or the payment number is below 1.</exception>
    public LumpSumExtraPayment(decimal amount, int paymentNumber)
    {
        ExtraPaymentGuard.AgainstInvalid(amount, paymentNumber);
        Amount = amount;
        PaymentNumber = paymentNumber;
    }

    /// <summary>The extra principal paid.</summary>
    public decimal Amount { get; }

    /// <summary>The payment the lump sum is made with.</summary>
    public int PaymentNumber { get; }

    /// <inheritdoc />
    public decimal AmountFor(int paymentNumber) => paymentNumber == PaymentNumber ? Amount : 0m;
}
