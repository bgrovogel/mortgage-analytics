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
        var analysis = Run(request);
        var (purchase, valuation, plan, comparison, rates) = analysis;
        var response = comparison.ToResponse(purchase, valuation, plan, rates, request.ToClosingCosts());
        return response with
        {
            AnnualPercentageRate = AprAnalysis.For(response),
            InFiveYears = LoanEstimateFigures.InFiveYears(response),
            TotalInterestPercentage = LoanEstimateFigures.TotalInterestPercentage(response),
            PmiOtherChoice = rates.Program is null ? PmiOtherChoice(request, purchase, valuation, rates.Loan, comparison) : null,
            SellerOffer = SellerOfferComparison.For(request, analysis, Run),
            Affordability = AffordabilityAnalysis.For(request, analysis, QualifyingPayment),
            RentOrBuy = RentOrBuyAnalysis.For(request, analysis),
        };
    }

    /// <summary>Builds the loan, its housing costs and its schedules, and how its payments are figured.</summary>
    private Analysis Run(AmortizationRequest request)
    {
        var (purchase, program, loan, valuation, plan) = Prepare(request);
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
        return new Analysis(purchase, valuation, plan, comparison, rates);
    }

    /// <summary>The purchase, the loan (with an FHA or VA program's upfront fee), the home's values and the housing costs.</summary>
    private (PropertyPurchase Purchase, GovernmentLoan? Program, LoanTerms Loan, PropertyValuation Valuation, HousingCostPlan Plan) Prepare(
        AmortizationRequest request)
    {
        var purchase = request.ToPurchase();
        var firstPayment = request.FirstPaymentDate ?? clock.FirstOfNextMonth();
        // An FHA or VA loan borrows its upfront fee too, unless it is paid at closing.
        var program = request.ToGovernmentLoan(purchase, firstPayment);
        var loan = request.ToLoanTerms(program?.LoanAmount ?? purchase.LoanAmount, firstPayment);
        var valuation = request.HousingCosts.ToValuation(purchase);

        var plan = request.HousingCosts.ToHousingCostPlan(purchase, valuation, request.TermInMonths);
        if (program is { Program: LoanProgram.Fha })
        {
            // FHA's MIP is figured on the original schedule at the starting rate, whatever the rate does later.
            var original = comparer.Compare(
                new LoanTerms(loan.Principal, loan.AnnualInterestRate, loan.TermInMonths, loan.FirstPaymentDate),
                ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None).Baseline;
            plan = plan.With(new FhaMortgageInsurance(program, original));
        }
        return (purchase, program, loan, valuation, plan);
    }

    /// <summary>
    /// The first month's payment as a lender qualifies it: principal and interest at the qualifying rate (a temporary
    /// buydown's subsidy left out), and every housing cost. No schedule is needed, so searching prices stays quick.
    /// </summary>
    private decimal QualifyingPayment(AmortizationRequest request, decimal annualRate)
    {
        var (_, _, loan, _, plan) = Prepare(request);
        return PaymentFormula.MonthlyPayment(loan.Principal, annualRate / 100m / 12m, loan.TermInMonths) + plan.FirstMonth(loan.Principal).Total;
    }

    /// <summary>
    /// Automatic PMI removal follows the original schedule, so extra payments never bring it forward; a borrower's
    /// request at 80% follows the actual balance. The same extra payments are run once more the other way, to say
    /// when PMI would end that way and what asking saves. Null when both ways end it together.
    /// </summary>
    private PmiOtherChoiceResponse? PmiOtherChoice(
        AmortizationRequest request, PropertyPurchase purchase, PropertyValuation valuation, LoanTerms loan, LoanComparison comparison)
    {
        if (request.HousingCosts is not { } costs || !purchase.RequiresMortgageInsurance)
            return null;

        var removal = costs.PmiCancellation == PmiCancellation.Automatic ? PmiCancellation.BorrowerRequested : PmiCancellation.Automatic;
        var otherWay = comparer.Compare(
            loan, request.ExtraPayments.ToExtraPaymentPlan(), request.ToRecastPolicy(),
            (costs with { PmiCancellation = removal }).ToHousingCostPlan(purchase, valuation, request.TermInMonths));
        var savedByAsking = Math.Abs(comparison.AcceleratedCosts.Totals[HousingCostCategory.MortgageInsurance]
            - otherWay.AcceleratedCosts.Totals[HousingCostCategory.MortgageInsurance]);
        return savedByAsking > 0 && otherWay.AcceleratedCosts.MortgageInsuranceLastPayment is { } last
            ? new PmiOtherChoiceResponse(removal, otherWay.Accelerated.Payments[last - 1].DueDate, savedByAsking)
            : null;
    }
}
