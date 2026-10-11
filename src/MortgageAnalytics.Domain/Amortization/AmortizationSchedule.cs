namespace MortgageAnalytics.Domain.Amortization;

/// <summary>A complete payoff schedule, any recasts that happened, and the totals derived from them.</summary>
public sealed class AmortizationSchedule
{
    /// <summary>Creates a schedule from its rows.</summary>
    /// <param name="initialMonthlyPayment">The principal-and-interest payment at origination.</param>
    /// <param name="payments">Every payment in order, ending with the one that clears the balance.</param>
    /// <param name="recasts">Recasts that happened along the way. Pass none when the loan was never recast.</param>
    /// <param name="rateChanges">Rate changes that happened along the way. Pass none for a fixed rate.</param>
    /// <exception cref="DomainValidationException">There are no payments.</exception>
    public AmortizationSchedule(
        decimal initialMonthlyPayment,
        IReadOnlyList<ScheduledPayment> payments,
        IReadOnlyList<RecastEvent>? recasts = null,
        IReadOnlyList<RateChangeEvent>? rateChanges = null)
    {
        if (payments.Count == 0)
            throw new DomainValidationException("A schedule must contain at least one payment.");

        InitialMonthlyPayment = initialMonthlyPayment;
        Payments = payments;
        Recasts = recasts ?? [];
        RateChanges = rateChanges ?? [];
        TotalInterest = payments.Sum(p => p.Interest);
        TotalPrincipal = payments.Sum(p => p.Principal + p.ExtraPrincipal);
        TotalRecastFees = Recasts.Sum(r => r.Fee);
    }

    /// <summary>The principal-and-interest payment at origination. A recast can lower it later.</summary>
    public decimal InitialMonthlyPayment { get; }

    /// <summary>Every payment, in order.</summary>
    public IReadOnlyList<ScheduledPayment> Payments { get; }

    /// <summary>Recasts that happened during the schedule, in order.</summary>
    public IReadOnlyList<RecastEvent> Recasts { get; }

    /// <summary>Rate changes during the schedule, in order, with the payment before and after each.</summary>
    public IReadOnlyList<RateChangeEvent> RateChanges { get; }

    /// <summary>All interest paid over the life of the loan.</summary>
    public decimal TotalInterest { get; }

    /// <summary>All principal repaid, scheduled and extra. Always equals the loan amount.</summary>
    public decimal TotalPrincipal { get; }

    /// <summary>All recast fees charged.</summary>
    public decimal TotalRecastFees { get; }

    /// <summary>Everything paid to the lender: principal plus interest. Recast fees are reported separately.</summary>
    public decimal TotalPaid => TotalPrincipal + TotalInterest;

    /// <summary>How many payments it takes to clear the loan.</summary>
    public int NumberOfPayments => Payments.Count;

    /// <summary>The due date of the final payment.</summary>
    public DateOnly PayoffDate => Payments[^1].DueDate;
}
