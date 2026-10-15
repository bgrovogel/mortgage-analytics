using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// The loan's APR, from what the analysis already worked out. The borrower receives the amount borrowed less the
/// charges paid up front that are finance charges: the lender's loan costs, prepaid interest, discount points and an
/// FHA or VA upfront fee (borrowed or paid at closing). Recording fees, transfer taxes, title and the escrow deposit
/// are not. Each month pays the loan's payment at its starting rate, plus that month's mortgage insurance.
/// </summary>
internal static class AprAnalysis
{
    /// <summary>The APR as a percentage, or null when there is nothing to put a rate on.</summary>
    /// <param name="response">The analysis, before the APR is added.</param>
    public static decimal? For(AmortizationResponse response)
    {
        var borrowed = response.Program?.LoanAmount ?? response.Purchase.LoanAmount;
        var cash = response.CashToClose;
        var charges = (cash?.LoanCosts ?? 0m) + (cash?.PrepaidInterest ?? 0m) + (response.DiscountPoints?.Cost ?? 0m)
            + (response.Program?.UpfrontFee ?? 0m);

        // A level payment for every month of the term, as the starting rate would have it: a later reset or a
        // temporary buydown is not part of the rate the lender quotes.
        var payment = response.Baseline.MonthlyPayment;
        var payments = response.Baseline.Payments.Select(p => payment + p.Costs.MortgageInsurance).ToList();
        return AnnualPercentageRate.Of(borrowed - charges, payments);
    }
}
