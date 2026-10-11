using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Refinancing;

namespace MortgageAnalytics.Application.Services;

/// <summary>Compares keeping a mortgage with refinancing it.</summary>
public interface IRefinanceService
{
    /// <summary>Runs the comparison for an already-validated request.</summary>
    /// <param name="request">A request that has passed <see cref="Validation.RefinanceRequestValidator"/>.</param>
    /// <param name="includePayments">False to leave out every payment row and keep only the summaries.</param>
    /// <returns>The current, refinanced and keep-the-payment options, and what refinancing saves or costs.</returns>
    RefinanceResponse Analyze(RefinanceRequest request, bool includePayments = true);
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
    public RefinanceResponse Analyze(RefinanceRequest request, bool includePayments = true)
    {
        var analysis = analyzer.Analyze(CurrentLoan(request, worstCase: false), request.ToOffer());

        // When either loan adjusts, the comparison also runs with rates rising as far as the caps allow.
        var adjusts = request.CurrentAdjustableRate is not null || request.NewAdjustableRate is not null;
        var worst = adjusts ? analyzer.Analyze(CurrentLoan(request, worstCase: true), request.ToOffer(worstCase: true)).LifetimeSavings : (decimal?)null;

        return analysis.ToResponse(includePayments, worst);
    }

    /// <summary>
    /// The current loan as it stands today, with an adjustable rate's resets ahead: counted from the original first
    /// payment for a loan given as it was taken out (then brought up to today), otherwise from the next payment.
    /// </summary>
    private LoanTerms CurrentLoan(RefinanceRequest request, bool worstCase)
    {
        var arm = request.CurrentAdjustableRate.ToDomain(request.CurrentAnnualInterestRate, worstCase);
        LoanTerms WithResets(LoanTerms loan) => arm is null ? loan : loan.WithRateChanges(arm.RatePath(loan.AnnualInterestRate, loan.TermInMonths));

        return request.ToOriginalLoan() is { } original
            ? calculator.RemainingAsOf(WithResets(original), clock.Today())
            : WithResets(request.ToCurrentLoan(clock.FirstOfNextMonth()));
    }
}
