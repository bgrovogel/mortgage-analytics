using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Application.Services;

/// <summary>The application's single use case: analyze a mortgage.</summary>
public interface IAmortizationService
{
    /// <summary>Builds the standard and accelerated schedules, with housing costs, for an already-validated request.</summary>
    /// <param name="request">A request that has passed <see cref="Validation.AmortizationRequestValidator"/>.</param>
    /// <returns>Both schedules, the purchase summary and the savings.</returns>
    AmortizationResponse Analyze(AmortizationRequest request);
}

/// <summary>
/// Maps the request into domain objects, runs the comparison, and maps the result back.
/// "Today" comes from <see cref="TimeProvider"/>, so tests can pin the date.
/// </summary>
/// <param name="comparer">Runs the standard and accelerated schedules.</param>
/// <param name="clock">Supplies today's date for the default first payment.</param>
public sealed class AmortizationService(ILoanComparer comparer, TimeProvider clock) : IAmortizationService
{
    /// <inheritdoc />
    public AmortizationResponse Analyze(AmortizationRequest request)
    {
        var purchase = request.ToPurchase();
        var loan = request.ToLoanTerms(purchase, clock.FirstOfNextMonth());
        var valuation = request.HousingCosts.ToValuation(purchase);

        var plan = request.HousingCosts.ToHousingCostPlan(purchase, valuation);
        var comparison = comparer.Compare(loan, request.ExtraPayments.ToExtraPaymentPlan(), request.ToRecastPolicy(), plan);

        // An adjustable rate also shows its worst case: the standard schedule if rates rise as far as the caps allow.
        var worstCase = request.ToAdjustableRate() is { } arm
            ? comparer.Compare(
                loan.WithAdjustableRate(arm.WorstCase(loan.AnnualInterestRate)),
                ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None).Baseline
            : null;

        return comparison.ToResponse(purchase, valuation, plan, new LoanRates(loan, request.ToBuydown(), worstCase));
    }
}
