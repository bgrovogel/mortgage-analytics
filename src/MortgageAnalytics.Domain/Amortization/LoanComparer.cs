using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Amortization;

/// <summary>Runs the same loan through one calculator twice, with and without extra payments.</summary>
/// <param name="calculator">The schedule generator to use for both runs.</param>
public sealed class LoanComparer(IAmortizationCalculator calculator) : ILoanComparer
{
    /// <inheritdoc />
    public LoanComparison Compare(LoanTerms loan, ExtraPaymentPlan extraPayments, RecastPolicy recastPolicy, HousingCostPlan housingCosts)
    {
        var baseline = calculator.Generate(loan, ExtraPaymentPlan.None, RecastPolicy.Never);
        var accelerated = extraPayments.IsEmpty ? baseline : calculator.Generate(loan, extraPayments, recastPolicy);

        var baselineCosts = housingCosts.ApplyTo(baseline);
        var acceleratedCosts = ReferenceEquals(accelerated, baseline) ? baselineCosts : housingCosts.ApplyTo(accelerated);

        return new LoanComparison(baseline, accelerated, baselineCosts, acceleratedCosts);
    }
}
