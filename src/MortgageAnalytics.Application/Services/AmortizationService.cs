using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Data;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

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
        var firstPayment = request.FirstPaymentDate ?? clock.FirstOfNextMonth();
        // An FHA or VA loan borrows its upfront fee too, unless it is paid at closing.
        var program = request.ToGovernmentLoan(purchase, firstPayment);
        var loan = request.ToLoanTerms(program?.LoanAmount ?? purchase.LoanAmount, firstPayment);
        var valuation = request.HousingCosts.ToValuation(purchase);

        var plan = request.HousingCosts.ToHousingCostPlan(purchase, valuation);
        if (program is { Program: LoanProgram.Fha })
        {
            // FHA's MIP is figured on the original schedule at the starting rate, whatever the rate does later.
            var original = comparer.Compare(
                new LoanTerms(loan.Principal, loan.AnnualInterestRate, loan.TermInMonths, loan.FirstPaymentDate),
                ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None).Baseline;
            plan = plan.With(new FhaMortgageInsurance(program, original));
        }
        var comparison = comparer.Compare(loan, request.ExtraPayments.ToExtraPaymentPlan(), request.ToRecastPolicy(), plan);

        // An adjustable rate also shows its worst case: the standard schedule if rates rise as far as the caps allow.
        var worstCase = request.ToAdjustableRate() is { } arm
            ? comparer.Compare(
                loan.WithAdjustableRate(arm.WorstCase(loan.AnnualInterestRate)),
                ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None).Baseline
            : null;

        // Discount points are weighed against the same loan at the rate offered without them, on its standard schedule.
        var points = request.ToDiscountPoints();
        var withoutPoints = points is null
            ? null
            : comparer.Compare(
                new LoanTerms(loan.Principal, points.RateWithoutPoints, loan.TermInMonths, loan.FirstPaymentDate),
                ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None).Baseline;

        var county = request.Program is { Type: LoanProgramType.Fha, CountyFips: { } fips } ? FhaLoanLimitData.Current.Find(fips) : null;
        var rates = new LoanRates(loan, request.ToBuydown(), worstCase, request.BuydownPaidBy.ToDomain(), points, withoutPoints, program, county);
        return comparison.ToResponse(purchase, valuation, plan, rates, request.ToClosingCosts());
    }
}
