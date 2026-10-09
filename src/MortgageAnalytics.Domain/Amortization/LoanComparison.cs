using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Domain.Amortization;

/// <summary>
/// A standard schedule side by side with an accelerated one, with housing costs for each,
/// and what the extra payments actually save.
/// </summary>
/// <param name="Baseline">The loan with no extra payments and no recasts.</param>
/// <param name="Accelerated">The loan with extra payments (and recasts, if any) applied.</param>
/// <param name="BaselineCosts">Housing costs charged alongside <paramref name="Baseline"/>.</param>
/// <param name="AcceleratedCosts">Housing costs charged alongside <paramref name="Accelerated"/>.</param>
public sealed record LoanComparison(
    AmortizationSchedule Baseline,
    AmortizationSchedule Accelerated,
    HousingCostSchedule BaselineCosts,
    HousingCostSchedule AcceleratedCosts)
{
    /// <summary>Interest avoided by paying extra.</summary>
    public decimal InterestSaved => Baseline.TotalInterest - Accelerated.TotalInterest;

    /// <summary>PMI avoided because the balance reached the cancellation point sooner.</summary>
    public decimal MortgageInsuranceSaved =>
        BaselineCosts.Totals[HousingCostCategory.MortgageInsurance] - AcceleratedCosts.Totals[HousingCostCategory.MortgageInsurance];

    /// <summary>Fees paid to recast the loan, which reduce the net benefit.</summary>
    public decimal RecastFees => Accelerated.TotalRecastFees;

    /// <summary>
    /// The real benefit: interest saved plus PMI saved, minus recast fees.
    /// Taxes, insurance and HOA dues are excluded on purpose, because they continue after payoff.
    /// </summary>
    public decimal NetSavings => InterestSaved + MortgageInsuranceSaved - RecastFees;

    /// <summary>How many fewer payments the accelerated schedule takes.</summary>
    public int PaymentsSaved => Baseline.NumberOfPayments - Accelerated.NumberOfPayments;

    /// <summary>All extra principal paid in the accelerated schedule.</summary>
    public decimal TotalExtraPrincipal => Accelerated.Payments.Sum(p => p.ExtraPrincipal);
}
