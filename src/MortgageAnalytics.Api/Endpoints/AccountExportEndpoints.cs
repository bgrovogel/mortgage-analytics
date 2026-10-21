using System.Buffers.Text;
using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Passkeys;
using MortgageAnalytics.Application.Preferences;
using MortgageAnalytics.Application.SavedCalculations;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>"Download your data": everything an account holds, as one JSON file, for the signed-in user alone.</summary>
public static class AccountExportEndpoints
{
    /// <summary>Maps the export under <c>/api/v1/account/export</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapAccountExportEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/v1/account/export", Export)
            .WithTags("Account")
            .RequireAuthorization()
            .WithName("ExportAccountData")
            .WithSummary("Download everything the account holds, as a JSON file.")
            .WithDescription("The email, every saved calculation with its inputs, each passkey's name and dates, and the key-figure arrangement. Never a password hash or a passkey's key.")
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        return routes;
    }

    private static async Task<Results<Ok<AccountExport>, ProblemHttpResult>> Export(
        HttpContext http, ClaimsPrincipal principal, UserManager<IdentityUser> users, ISavedCalculationService calculations,
        IPasskeyRepository passkeys, IUserPreferencesRepository preferences, TimeProvider clock, CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(principal);
        if (user is null)
            return TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Sign in first.");

        var now = clock.GetUtcNow();
        var saved = await calculations.ListAsync(user.Id, null, cancellationToken);
        var keys = await passkeys.ListAsync(user.Id, cancellationToken);
        var export = new AccountExport(
            user.Email!, now, saved,
            [.. keys.Select(p => new PasskeyResponse(Base64Url.EncodeToString(p.CredentialId), p.Name, p.CreatedAt, p.LastUsedAt))],
            await preferences.GetKeyFiguresAsync(user.Id, cancellationToken));

        http.Response.Headers.ContentDisposition = $"attachment; filename=mortgage-analytics-data-{now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}.json";
        return TypedResults.Ok(export);
    }
}
