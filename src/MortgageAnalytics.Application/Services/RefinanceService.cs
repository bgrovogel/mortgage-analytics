using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Refinancing;

namespace MortgageAnalytics.Application.Services;

/// <summary>Compares keeping a mortgage with refinancing it.</summary>
public interface IRefinanceService
{
    /// <summary>Runs the comparison for an already-validated request.</summary>
    /// <param name="request">A request that has passed <see cref="Validation.RefinanceRequestValidator"/>.</param>
    /// <returns>The current, refinanced and keep-the-payment options, and what refinancing saves or costs.</returns>
    RefinanceResponse Analyze(RefinanceRequest request);
}

/// <summary>
/// Maps the request into the domain, runs the analyzer, and maps the result back. A loan given as it was taken out
/// is first brought up to today on its own schedule.
/// </summary>
/// <param name="analyzer">The domain refinance comparison.</param>
/// <param name="calculator">Builds the original loan's schedule, to find what is owed today.</param>
/// <param name="clock">Supplies today's date, and the default next payment.</param>
public sealed class RefinanceService(IRefinanceAnalyzer analyzer, IAmortizationCalculator calculator, TimeProvider clock) : IRefinanceService
{
    /// <inheritdoc />
    public RefinanceResponse Analyze(RefinanceRequest request)
    {
        var pmi = request.ToPmi();
        var currentLoan = CurrentLoan(request, worstCase: false);

        // Points are paid with the closing costs, so every figure below counts them; they are a share of what is borrowed before any financed costs.
        var points = request.NewDiscountPoints is { } bought ? new DiscountPoints(bought.Points, bought.RateWithoutPoints) : null;
        var pointsBase = currentLoan.Principal + request.CashOut;
        var analysis = AnalyzeOffer(request, currentLoan, pmi);

        // When either loan adjusts, the comparison also runs with rates rising as far as the caps allow.
        var adjusts = request.CurrentAdjustableRate is not null || request.NewAdjustableRate is not null;
        var worst = adjusts ? analyzer.Analyze(CurrentLoan(request, worstCase: true), request.ToOffer(worstCase: true), pmi).LifetimeSavings : (decimal?)null;

        return analysis.ToResponse(worst, request.HomeValue) with
        {
            HomeEquity = HomeEquityComparison.For(request, analysis),
            Points = PointsOn(request, analysis, points, pointsBase),
            // What the debt adds to the new loan is that loan less the same refinance with the debt's balance out of the cash.
            DebtPayoff = request.DebtPayoff is { } debt
                ? DebtPayoffComparison.For(debt, analysis, AnalyzeOffer(request with { CashOut = request.CashOut - debt.Balance, DebtPayoff = null }, currentLoan, pmi))
                : null,
        };
    }

    /// <summary>The refinance as the request asks it: points are paid with the closing costs, a share of what is borrowed before any financed costs.</summary>
    private RefinanceAnalysis AnalyzeOffer(RefinanceRequest request, LoanTerms currentLoan, RefinancePmi? pmi)
    {
        var points = request.NewDiscountPoints is { } bought ? new DiscountPoints(bought.Points, bought.RateWithoutPoints) : null;
        return analyzer.Analyze(currentLoan, request.ToOffer(extraClosingCosts: points?.CostFor(currentLoan.Principal + request.CashOut) ?? 0m), pmi);
    }

    /// <summary>
    /// What the points are worth: two loans of the same size, the new loan's with any other financed costs in it and the points paid
    /// at closing, at the rate with the points and at the rate without. Null when no points were bought.
    /// </summary>
    private RefinancePointsResponse? PointsOn(RefinanceRequest request, RefinanceAnalysis analysis, DiscountPoints? points, decimal pointsBase)
    {
        if (points is null)
            return null;

        var principal = pointsBase + (request.FinanceClosingCosts ? request.ClosingCosts : 0m);
        var firstPayment = analysis.Refinanced.Payments[0].DueDate;
        var withPoints = calculator.Generate(new LoanTerms(principal, request.NewAnnualInterestRate, request.NewTermInMonths, firstPayment), ExtraPaymentPlan.None, RecastPolicy.Never);
        var withoutPoints = calculator.Generate(new LoanTerms(principal, points.RateWithoutPoints, request.NewTermInMonths, firstPayment), ExtraPaymentPlan.None, RecastPolicy.Never);
        var comparison = points.Compare(pointsBase, withPoints, withoutPoints);

        return new RefinancePointsResponse(
            points.Points, comparison.Cost, request.NewAnnualInterestRate, points.RateWithoutPoints,
            withPoints.InitialMonthlyPayment, withoutPoints.InitialMonthlyPayment, comparison.MonthlySaving, comparison.InterestSaved,
            comparison.NetSaving, comparison.BreakEvenPayment,
            comparison.BreakEvenPayment is { } number ? withPoints.Payments[number - 1].DueDate : null);
    }

    /// <summary>
    /// The current loan as it stands today, with an adjustable rate's resets ahead: counted from the original first
    /// payment for a loan given as it was taken out (then brought up to today), otherwise from the next payment.
    /// </summary>
    private LoanTerms CurrentLoan(RefinanceRequest request, bool worstCase)
    {
        var arm = request.CurrentAdjustableRate.ToDomain(request.CurrentAnnualInterestRate, worstCase);

        return request.ToOriginalLoan() is { } original
            ? calculator.RemainingAsOf(original.WithAdjustableRate(arm), clock.Today())
            : request.ToCurrentLoan(clock.FirstOfNextMonth()).WithAdjustableRate(arm);
    }
}
