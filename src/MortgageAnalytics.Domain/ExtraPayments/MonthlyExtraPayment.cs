namespace MortgageAnalytics.Domain.ExtraPayments;

/// <summary>A fixed extra amount added to every payment from <see cref="StartingPaymentNumber"/> onward.</summary>
public sealed class MonthlyExtraPayment : IExtraPaymentRule
{
    /// <summary>Creates a recurring monthly prepayment.</summary>
    /// <param name="amount">The extra principal paid each month.</param>
    /// <param name="startingPaymentNumber">The first payment that includes the extra. Defaults to the first payment.</param>
    /// <exception cref="DomainValidationException">The amount is negative or the start is below payment 1.</exception>
    public MonthlyExtraPayment(decimal amount, int startingPaymentNumber = 1)
    {
        ExtraPaymentGuard.AgainstInvalid(amount, startingPaymentNumber);
        Amount = amount;
        StartingPaymentNumber = startingPaymentNumber;
    }

    /// <summary>The extra principal paid each month.</summary>
    public decimal Amount { get; }

    /// <summary>The first payment that includes the extra.</summary>
    public int StartingPaymentNumber { get; }

    /// <inheritdoc />
    public decimal AmountFor(int paymentNumber) => paymentNumber >= StartingPaymentNumber ? Amount : 0m;
}
