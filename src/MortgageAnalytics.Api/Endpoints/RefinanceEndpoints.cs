using Microsoft.AspNetCore.Http.HttpResults;
using MortgageAnalytics.Api.Filters;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>The HTTP surface for the refinance comparison. A filter validates; the service does the work.</summary>
public static class RefinanceEndpoints
{
    /// <summary>Maps the refinance endpoint under <c>/api/v1/refinance</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapRefinanceEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGroup("/api/v1/refinance")
            .WithTags("Refinance")
            .MapPost("/analyze", Analyze)
            .WithName("AnalyzeRefinance")
            .WithSummary("Compare keeping a mortgage with refinancing it.")
            .WithDescription(
                "Returns the rest of the current loan, the new loan, and (when the new payment is lower) the new loan " +
                "while still paying today's payment. A refinance restarts the amortization clock, so a lower payment can " +
                "cost more in total: monthsAdded and lifetimeSavings show that, closing costs included. The break-even " +
                "is the payment by which the interest saved covers the closing costs, financed or not. " +
                "Pass includePayments=false to leave out the monthly rows.")
            .AddEndpointFilter<ValidationFilter<RefinanceRequest>>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status500InternalServerError);

        return routes;
    }

    /// <summary>Runs the comparison. The request has already been validated by <see cref="ValidationFilter{TRequest}"/>.</summary>
    /// <param name="request">The current loan and the offer.</param>
    /// <param name="service">The application service.</param>
    /// <param name="includePayments">False to leave out every payment row and keep only the summaries.</param>
    private static Ok<RefinanceResponse> Analyze(RefinanceRequest request, IRefinanceService service, bool includePayments = true)
    {
        var response = service.Analyze(request);
        return TypedResults.Ok(includePayments ? response : WithoutPayments(response));
    }

    /// <summary>The same response with the payment rows removed from every option.</summary>
    private static RefinanceResponse WithoutPayments(RefinanceResponse response) =>
        response with
        {
            Current = response.Current with { Payments = [] },
            Refinanced = response.Refinanced with { Payments = [] },
            KeepingCurrentPayment = response.KeepingCurrentPayment is { } keeping ? keeping with { Payments = [] } : null,
        };
}
