using Microsoft.AspNetCore.Http.HttpResults;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Rates;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>This week's average mortgage rates, a published figure anyone may read.</summary>
public static class RatesEndpoints
{
    /// <summary>The survey the rates come from, as the response names it.</summary>
    public const string Source = "Freddie Mac Primary Mortgage Market Survey";

    /// <summary>Maps the rates endpoint under <c>/api/v1/rates</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapRatesEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/v1/rates/average", Average)
            .WithTags("Rates")
            .WithName("GetAverageRates")
            .WithSummary("This week's average 30-year and 15-year fixed mortgage rates, as a starting point.")
            .WithDescription("From Freddie Mac's weekly survey, kept for hours on the server. 204, with no body, when it cannot be reached or is switched off: the app carries on without, and the browser logs no failed request.");

        return routes;
    }

    private static async Task<Results<Ok<AverageRatesResponse>, NoContent>> Average(IAverageRates rates, CancellationToken cancellationToken) =>
        await rates.GetAsync(cancellationToken) is { } average
            ? TypedResults.Ok(new AverageRatesResponse(average.AsOf, average.ThirtyYearFixed, average.FifteenYearFixed, Source))
            : TypedResults.NoContent();
}
