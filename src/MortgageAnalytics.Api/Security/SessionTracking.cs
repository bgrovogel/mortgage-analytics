using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using MortgageAnalytics.Application.Sessions;

namespace MortgageAnalytics.Api.Security;

/// <summary>
/// Gives every sign-in with the session cookie a record of its own, so an account can see where it is signed in and end
/// one from another. The sign-in stamps a session id into the cookie; each request asks whether that session is still
/// wanted, and a session that was ended is refused at its next request. Cookies from before this existed have no id and
/// carry on, unlisted, until they expire or the user signs in again.
/// </summary>
public static class SessionTracking
{
    /// <summary>The claim in the cookie that holds the session's id.</summary>
    public const string ClaimType = "mortgage-analytics:session";

    /// <summary>How long since a session was last recorded as used before its next use is recorded: a write every few minutes, not every request.</summary>
    public static readonly TimeSpan RecordUseAfter = TimeSpan.FromMinutes(5);

    private const string ItemKey = "mortgage-analytics:session-id";

    /// <summary>Adds the tracking to the session cookie's events, after Identity's own (the security stamp check) so both apply.</summary>
    /// <param name="options">The application cookie's options.</param>
    public static void Track(CookieAuthenticationOptions options)
    {
        var signingIn = options.Events.OnSigningIn;
        var validate = options.Events.OnValidatePrincipal;

        options.Events.OnSigningIn = async context =>
        {
            // A cookie being renewed already has its id; a new sign-in (or one made again, as a password change does) gets one.
            if (context.Principal?.FindFirst(ClaimType) is null && context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier) is { } owner)
            {
                var services = context.HttpContext.RequestServices;
                var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
                var session = new UserSession
                {
                    Id = Guid.NewGuid(), OwnerId = owner, CreatedAt = now, LastSeenAt = now,
                    Device = DeviceLabel.From(context.HttpContext.Request.Headers.UserAgent.ToString()),
                };
                await services.GetRequiredService<IUserSessionRepository>().AddAsync(session, context.HttpContext.RequestAborted);
                ((ClaimsIdentity)context.Principal.Identity!).AddClaim(new Claim(ClaimType, session.Id.ToString()));
                context.HttpContext.Items[ItemKey] = session.Id;
            }
            await signingIn(context);
        };

        options.Events.OnValidatePrincipal = async context =>
        {
            // Identity's check first (the security stamp): a session it refuses is gone, and so is its record.
            var id = IdOf(context.Principal);
            var owner = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            await validate(context);
            if (id is null || owner is null)
                return;

            var sessions = context.HttpContext.RequestServices.GetRequiredService<IUserSessionRepository>();
            if (context.Principal is null)
            {
                await sessions.DeleteAsync(owner, id.Value, context.HttpContext.RequestAborted);
                return;
            }

            // The check replaces the principal with a fresh one built from the user (and issues the cookie again), which has
            // none of the cookie's own claims: hand the session's id on, or the session would be lost at the next request.
            if (context.Principal.FindFirst(ClaimType) is null)
                ((ClaimsIdentity)context.Principal.Identity!).AddClaim(new Claim(ClaimType, id.Value.ToString()));

            var now = context.HttpContext.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow();
            if (!await sessions.TouchAsync(id.Value, owner, now, RecordUseAfter, context.HttpContext.RequestAborted))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(context.Scheme.Name);
            }
        };
    }

    /// <summary>The id of the session a principal's cookie carries; null for a cookie from before sessions were recorded.</summary>
    /// <param name="user">The request's user.</param>
    public static Guid? IdOf(ClaimsPrincipal? user) =>
        Guid.TryParse(user?.FindFirstValue(ClaimType), out var id) ? id : null;

    /// <summary>The id of the session this very request has just signed in, if it has: the new session after a password change.</summary>
    /// <param name="context">The request.</param>
    public static Guid? SignedInDuring(HttpContext context) =>
        context.Items.TryGetValue(ItemKey, out var id) && id is Guid session ? session : null;
}
