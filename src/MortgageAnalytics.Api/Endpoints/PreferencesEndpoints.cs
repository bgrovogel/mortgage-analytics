using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using MortgageAnalytics.Api.Filters;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Preferences;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>
/// What a signed-in user has chosen about how the app looks to them, so it follows them from device to device. Every
/// endpoint needs an account and works only on that user's own choices.
/// </summary>
public static class PreferencesEndpoints
{
    /// <summary>Maps the preferences endpoints under <c>/api/v1/account</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapPreferencesEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/account/key-figures")
            .WithTags("Preferences")
            .RequireAuthorization()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status500InternalServerError);

        group.MapGet("/", Get)
            .WithName("GetKeyFigures")
            .WithSummary("Get the key figures under the Cost headline, in the user's order.")
            .WithDescription("Empty lists when the user has not arranged them: the page's own order then applies.");

        group.MapPut("/", Save)
            .WithName("SaveKeyFigures")
            .WithSummary("Replace the user's arrangement of the key figures.")
            .AddEndpointFilter<ValidationFilter<KeyFigurePreferences>>()
            .ProducesValidationProblem();

        return routes;
    }

    private static async Task<Ok<KeyFigurePreferences>> Get(ClaimsPrincipal user, IUserPreferencesRepository preferences, CancellationToken cancellationToken) =>
        TypedResults.Ok(await preferences.GetKeyFiguresAsync(user.OwnerId(), cancellationToken));

    private static async Task<NoContent> Save(
        KeyFigurePreferences request, ClaimsPrincipal user, IUserPreferencesRepository preferences, CancellationToken cancellationToken)
    {
        await preferences.SaveKeyFiguresAsync(user.OwnerId(), request, cancellationToken);
        return TypedResults.NoContent();
    }
}
