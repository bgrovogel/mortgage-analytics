namespace MortgageAnalytics.Domain.Amortization;

/// <summary>A recast that happened during the schedule.</summary>
/// <param name="AfterPaymentNumber">The payment whose extra principal triggered the recast. The new payment starts with the next one.</param>
/// <param name="PreviousPayment">The monthly principal and interest before the recast.</param>
/// <param name="NewPayment">The monthly principal and interest after the recast.</param>
/// <param name="Fee">What the lender charged for the recast.</param>
public sealed record RecastEvent(int AfterPaymentNumber, decimal PreviousPayment, decimal NewPayment, decimal Fee);
