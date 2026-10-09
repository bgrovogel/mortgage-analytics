using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Amortization;

/// <summary>Compares paying a loan as scheduled with paying it off faster.</summary>
public interface ILoanComparer
{
    /// <summary>Builds the standard and accelerated schedules for one loan and works out the savings.</summary>
    /// <param name="loan">The loan to analyze.</param>
    /// <param name="extraPayments">Prepayments applied only to the accelerated schedule.</param>
    /// <param name="recastPolicy">When the accelerated schedule is recast. The baseline is never recast.</param>
    /// <param name="housingCosts">Taxes, insurance, PMI and dues charged alongside both schedules.</param>
    LoanComparison Compare(LoanTerms loan, ExtraPaymentPlan extraPayments, RecastPolicy recastPolicy, HousingCostPlan housingCosts);
}
