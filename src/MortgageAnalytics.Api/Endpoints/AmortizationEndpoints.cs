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
                "Returns both month-by-month schedules, housing costs (school, county/city and MUD tax with homestead " +
                "exemptions, PID, insurance, PMI, HOA), any recasts, a yearly projection and the net savings. " +
                "Extra payments larger than the outstanding balance are capped, so the loan is never overpaid. " +
                "Savings count interest and PMI only, because taxes, insurance and dues continue after payoff. " +
                "Pass includePayments=false to leave out the monthly rows (up to 1,200) when only the summaries are needed.")
            .AddEndpointFilter<ValidationFilter<AmortizationRequest>>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status500InternalServerError);

        return routes;
    }

    /// <summary>Runs the analysis. The request has already been validated by <see cref="ValidationFilter{TRequest}"/>.</summary>
    /// <param name="request">The purchase and loan to analyze.</param>
    /// <param name="service">The application service.</param>
    /// <param name="includePayments">False to leave out every monthly payment row and keep only the summaries.</param>
    private static Ok<AmortizationResponse> Calculate(AmortizationRequest request, IAmortizationService service, bool includePayments = true)
    {
        var response = service.Analyze(request);
        return TypedResults.Ok(includePayments ? response : WithoutPayments(response));
    }

    /// <summary>The same response with the monthly rows removed from both schedules.</summary>
    private static AmortizationResponse WithoutPayments(AmortizationResponse response) =>
        response with
        {
            Baseline = response.Baseline with { Payments = [] },
            Accelerated = response.Accelerated with { Payments = [] },
        };
}
