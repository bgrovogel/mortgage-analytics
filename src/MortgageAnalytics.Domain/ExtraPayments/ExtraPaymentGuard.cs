namespace MortgageAnalytics.Domain.ExtraPayments;

/// <summary>Shared guard clauses for extra-payment rule constructors.</summary>
internal static class ExtraPaymentGuard
{
    /// <summary>Throws when the amount is negative or the payment number is below 1.</summary>
    public static void AgainstInvalid(decimal amount, int paymentNumber)
    {
        if (amount < 0)
            throw new DomainValidationException("Extra payment amount cannot be negative.");
        if (paymentNumber < 1)
            throw new DomainValidationException("Extra payments must start on payment 1 or later.");
    }
}
