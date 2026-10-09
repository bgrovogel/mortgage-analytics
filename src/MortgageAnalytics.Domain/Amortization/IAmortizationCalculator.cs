using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Amortization;

/// <summary>Builds month-by-month repayment schedules.</summary>
public interface IAmortizationCalculator
{
    /// <summary>Generates the full schedule for <paramref name="loan"/>.</summary>
    /// <param name="loan">The loan to repay.</param>
    /// <param name="extraPayments">Prepayments to apply. Use <see cref="ExtraPaymentPlan.None"/> for a standard schedule.</param>
    /// <param name="recastPolicy">When to re-amortize after a prepayment. Use <see cref="RecastPolicy.Never"/> to shorten the term instead.</param>
    /// <returns>A schedule whose final remaining balance is exactly zero.</returns>
    AmortizationSchedule Generate(LoanTerms loan, ExtraPaymentPlan extraPayments, RecastPolicy recastPolicy);
}
