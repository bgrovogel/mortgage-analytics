using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using MortgageAnalytics.Api.Security;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Sessions;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>
/// Where the signed-in account is signed in, and ending those places from another: see the sign-ins, end one, or end all
/// but this one. Every endpoint needs an account and works only on that account's own sessions.
/// </summary>
public static class SessionEndpoints
{
    /// <summary>How long a session lasts without use: the cookie's own lifetime, after which it is not somewhere you are signed in.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(14);

    /// <summary>Maps the session endpoints under <c>/api/v1/account/sessions</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/account/sessions")
            .WithTags("Account")
            .RequireAuthorization()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status500InternalServerError);

        group.MapGet("/", List)
            .WithName("ListSessions")
            .WithSummary("Where the account is signed in, most recently used first, with the one making this request marked.");

        group.MapPost("/end-others", EndOthers)
            .WithName("EndOtherSessions")
            .WithSummary("Sign out everywhere but here: end every other session. Each device is signed out at its next request.");

        group.MapDelete("/{id:guid}", End)
            .WithName("EndSession")
            .WithSummary("End one of the account's other sessions.")
            .WithDescription("Ending the session making the request is signing out, so it answers 400; use the sign-out endpoint. A session that is not the account's is a 404.")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return routes;
    }

    private static async Task<Ok<IReadOnlyList<UserSessionResponse>>> List(
        ClaimsPrincipal user, IUserSessionRepository sessions, TimeProvider clock, CancellationToken cancellationToken)
    {
        var current = SessionTracking.IdOf(user);
        var listed = await sessions.ListAsync(user.OwnerId(), clock.GetUtcNow() - Lifetime, cancellationToken);
        return TypedResults.Ok<IReadOnlyList<UserSessionResponse>>([.. listed.Select(s => new UserSessionResponse(s.Id, s.Device, s.CreatedAt, s.LastSeenAt, s.Id == current))]);
    }

    private static async Task<Ok<EndedSessionsResponse>> EndOthers(ClaimsPrincipal user, IUserSessionRepository sessions, CancellationToken cancellationToken) =>
        TypedResults.Ok(new EndedSessionsResponse(await sessions.DeleteOthersAsync(user.OwnerId(), SessionTracking.IdOf(user) ?? Guid.Empty, cancellationToken)));

    private static async Task<Results<NoContent, ProblemHttpResult, NotFound>> End(
        Guid id, ClaimsPrincipal user, IUserSessionRepository sessions, CancellationToken cancellationToken)
    {
        if (id == SessionTracking.IdOf(user))
            return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "That is the session you are using. To end it, sign out.");

        return await sessions.DeleteAsync(user.OwnerId(), id, cancellationToken) ? TypedResults.NoContent() : TypedResults.NotFound();
    }
}
