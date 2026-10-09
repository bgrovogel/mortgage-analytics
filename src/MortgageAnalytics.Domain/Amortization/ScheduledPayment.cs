namespace MortgageAnalytics.Domain.Amortization;

/// <summary>One row of an amortization schedule. All amounts are rounded to cents.</summary>
/// <param name="PaymentNumber">The 1-based period number.</param>
/// <param name="DueDate">The date the payment is due.</param>
/// <param name="Interest">Interest accrued on the opening balance this period.</param>
/// <param name="Principal">Principal repaid by the regular payment.</param>
/// <param name="ExtraPrincipal">Additional principal prepaid this period, already capped at the balance.</param>
/// <param name="RemainingBalance">The balance after this payment is applied.</param>
public sealed record ScheduledPayment(
    int PaymentNumber,
    DateOnly DueDate,
    decimal Interest,
    decimal Principal,
    decimal ExtraPrincipal,
    decimal RemainingBalance)
{
    /// <summary>The balance before this payment was applied.</summary>
    public decimal OpeningBalance => RemainingBalance + Principal + ExtraPrincipal;

    /// <summary>The regular payment: principal plus interest.</summary>
    public decimal ScheduledAmount => Principal + Interest;

    /// <summary>Everything paid to the lender this period, including extra principal.</summary>
    public decimal TotalPaid => ScheduledAmount + ExtraPrincipal;
}
