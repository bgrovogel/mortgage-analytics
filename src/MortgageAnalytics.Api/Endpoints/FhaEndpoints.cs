using Microsoft.AspNetCore.Http.HttpResults;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Data;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>FHA reference data: HUD's loan limits by county, for the form's county list.</summary>
public static class FhaEndpoints
{
    /// <summary>How long browsers may keep the limits: they change once a year.</summary>
    private const string CacheForADay = "public, max-age=86400";

    /// <summary>Maps the FHA endpoints under <c>/api/v1/fha</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapFhaEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGroup("/api/v1/fha").WithTags("FHA")
            .MapGet("/loan-limits", LoanLimits)
            .WithName("FhaLoanLimits")
            .WithSummary("HUD's FHA loan limits for one-unit homes, for every county, with each state's name.");
        return routes;
    }

    private static Ok<FhaLoanLimitsResponse> LoanLimits(HttpResponse response)
    {
        response.Headers.CacheControl = CacheForADay;
        return TypedResults.Ok(FhaLoanLimitData.Current);
    }
}
