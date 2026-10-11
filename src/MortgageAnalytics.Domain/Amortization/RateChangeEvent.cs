namespace MortgageAnalytics.Domain.Amortization;

/// <summary>A rate change that happened during the schedule, and what it did to the payment.</summary>
/// <param name="PaymentNumber">The first payment at the new rate.</param>
/// <param name="PreviousRate">The annual rate before the change, as a percentage.</param>
/// <param name="NewRate">The annual rate from this payment on, as a percentage.</param>
/// <param name="PreviousPayment">The monthly principal and interest before the change.</param>
/// <param name="NewPayment">The monthly principal and interest from this payment on: the balance re-amortized over the payments left.</param>
public sealed record RateChangeEvent(int PaymentNumber, decimal PreviousRate, decimal NewRate, decimal PreviousPayment, decimal NewPayment);
