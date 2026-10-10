using Microsoft.AspNetCore.Http.HttpResults;
using MortgageAnalytics.Api.Filters;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>The HTTP surface for the pay-off-or-invest comparison. A filter validates; the service does the work.</summary>
public static class StrategyEndpoints
{
    /// <summary>Maps the strategy endpoint under <c>/api/v1/strategies</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapStrategyEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGroup("/api/v1/strategies")
            .WithTags("Strategies")
            .MapPost("/compare", Compare)
            .WithName("CompareStrategies")
            .WithSummary("Compare paying the mortgage off first, investing the difference, and a hybrid.")
            .WithDescription(
                "Plays each strategy out month by month for 30 years. Every strategy first captures the 401(k) match and " +
                "any ESPP discount; only the cash left over is directed differently. Paying down the mortgage earns its rate " +
                "for certain, while market returns are an average, so each strategy runs at the expected return, at a " +
                "risk-adjusted return (expected minus the risk profile's margin), and with a lost decade first. The " +
                "recommendation rests on the risk-adjusted return. Mortgage interest saves tax only on the part of itemized " +
                "deductions above the standard deduction. Net worth counts every account after the tax still owed on it.")
            .AddEndpointFilter<ValidationFilter<StrategyRequest>>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status500InternalServerError);

        return routes;
    }

    /// <summary>Runs the comparison. The request has already been validated by <see cref="ValidationFilter{TRequest}"/>.</summary>
    private static Ok<StrategyComparisonResponse> Compare(StrategyRequest request, IStrategyService service) =>
        TypedResults.Ok(service.Compare(request));
}
