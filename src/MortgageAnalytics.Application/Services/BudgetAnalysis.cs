using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Affordability;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// The highest price a monthly budget reaches: the whole payment (principal and interest, taxes, insurance, mortgage
/// insurance and dues) at the loan's own rate, with the down payment share, rate and costs of the request held.
/// </summary>
internal static class BudgetAnalysis
{
    /// <summary>The price a budget reaches, or null when the request has no budget.</summary>
    /// <param name="request">The request as made.</param>
    /// <param name="analysis">The request analyzed, for the loan's rate.</param>
    /// <param name="qualifyingPayment">The first month's payment of a request, with its principal and interest at a rate.</param>
    public static BudgetResponse? For(
        AmortizationRequest request, Analysis analysis, Func<AmortizationRequest, decimal, decimal> qualifyingPayment)
    {
        if (request.MonthlyBudget is not { } budget)
            return null;

        // The note rate, not a lender's qualifying rate: a budget is what will actually be paid. A temporary buydown's
        // early years are not a budget the loan can keep, so its payment is the note rate's too.
        var paymentAt = PricedPayments.At(request, analysis.Rates.Loan.AnnualInterestRate, qualifyingPayment);
        var price = MostAffordable.Price(paymentAt, budget, request.HomePrice);
        return new BudgetResponse(budget, price, PricedPayments.DownPaymentAt(price, request.DownPayment / request.HomePrice));
    }
}
