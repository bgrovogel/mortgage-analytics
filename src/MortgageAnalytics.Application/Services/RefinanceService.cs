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
        var current = request.ToOriginalLoan() is { } original
            ? calculator.RemainingAsOf(original, clock.Today())
            : request.ToCurrentLoan(clock.FirstOfNextMonth());
        return analyzer.Analyze(current, request.ToOffer()).ToResponse(includePayments);
    }
}
