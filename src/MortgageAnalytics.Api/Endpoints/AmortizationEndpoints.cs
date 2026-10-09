using Microsoft.AspNetCore.Http.HttpResults;
using MortgageAnalytics.Api.Filters;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>
/// The HTTP surface for amortization analysis. Endpoints stay thin: a filter validates and the
/// application service does the work, so this class handles HTTP concerns only.
/// </summary>
public static class AmortizationEndpoints
{
    /// <summary>Maps every amortization endpoint under <c>/api/v1/amortization</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapAmortizationEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/amortization")
            .WithTags("Amortization");

        group.MapPost("/calculate", Calculate)
            .WithName("CalculateAmortization")
            .WithSummary("Analyze a home purchase: standard versus accelerated payoff, with taxes, insurance, PMI and recasts.")
            .WithDescription(
                "Returns both month-by-month schedules, housing costs (property tax, MUD, PID, insurance, PMI, HOA), " +
                "any recasts, and the net savings. Extra payments larger than the outstanding balance are capped " +
                "automatically, so the loan is never overpaid. Savings count interest and PMI only, because taxes, " +
                "insurance and dues continue after payoff.")
            .AddEndpointFilter<ValidationFilter<AmortizationRequest>>()
            .ProducesValidationProblem();

        return routes;
    }

    /// <summary>Runs the analysis. The request has already been validated by <see cref="ValidationFilter{TRequest}"/>.</summary>
    private static Ok<AmortizationResponse> Calculate(AmortizationRequest request, IAmortizationService service) =>
        TypedResults.Ok(service.Analyze(request));
}
