namespace MortgageAnalytics.Domain.ExtraPayments;

/// <summary>
/// One way of prepaying principal (monthly, annually, a lump sum, ...).
/// A new kind of prepayment is added by implementing this interface; the calculator does not change (Open/Closed).
/// </summary>
public interface IExtraPaymentRule
{
    /// <summary>Returns the extra principal this rule contributes to payment <paramref name="paymentNumber"/>, or zero.</summary>
    decimal AmountFor(int paymentNumber);
}
