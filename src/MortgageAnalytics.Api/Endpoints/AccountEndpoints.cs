using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using MortgageAnalytics.Infrastructure;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>
/// User accounts, with ASP.NET Core Identity: its built-in endpoints (register, confirm email, login,
/// forgot and reset password, account info) under <c>/api/v1/account</c>, plus sign-out, changing the password and
/// deleting the account. The browser signs in with <c>login?useCookies=true</c> and
/// then carries an HttpOnly, SameSite=Strict session cookie, which scripts cannot read and other sites
/// cannot send.
/// </summary>
public static class AccountEndpoints
{
    /// <summary>The rate-limiting policy on account attempts.</summary>
    public const string AttemptsPolicy = "account-attempts";

    /// <summary>Account attempts allowed per client address per minute, unless configured otherwise.</summary>
    public const int DefaultAttemptsPerMinute = 10;

    /// <summary>Registers Identity, its password rules, the session cookie and the keys that sign them.</summary>
    /// <param name="services">The container to add to.</param>
    /// <param name="configuration">The app's configuration (<c>DataProtection:KeysDirectory</c>).</param>
    /// <param name="environment">Supplies the content root for a relative keys directory.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddAccounts(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        // Session cookies and the codes in confirmation and reset emails are signed with these keys. Kept on
        // disk (a volume in Docker), they survive restarts, so nobody is signed out and no emailed link breaks.
        var keys = Path.GetFullPath(configuration["DataProtection:KeysDirectory"] ?? "App_Data/keys", environment.ContentRootPath);
        services.AddDataProtection().SetApplicationName("MortgageAnalytics").PersistKeysToFileSystem(new DirectoryInfo(keys));

        services.AddAuthorization();
        services
            .AddIdentityApiEndpoints<IdentityUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                // Sign-in waits until the email is confirmed, so an account always belongs to a real inbox.
                options.SignIn.RequireConfirmedEmail = true;
                // Length matters more than character classes (NIST SP 800-63B): 8+ characters with a digit.
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireLowercase = false;
            })
            .AddEntityFrameworkStores<CalculationsDbContext>();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "mortgage-analytics.session";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;
        });

        // Check every session against its user on each request (one lookup by id), not every 30 minutes as Identity
        // would: a deleted account, or a password reset, then ends the account's other sessions at once.
        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);

        services.AddAttemptLimit(configuration.GetValue("RateLimiting:AccountPermitsPerMinute", DefaultAttemptsPerMinute));

        return services;
    }

    /// <summary>
    /// Limits account attempts (sign-in, sign-up, emailed links, password resets) from one address to
    /// <paramref name="permitsPerMinute"/>, so a script can't guess passwords at speed or flood someone's inbox. Reads
    /// (who is signed in, asked on every page load) are never limited. Over the limit is a 429 problem that says when
    /// to try again.
    /// </summary>
    private static void AddAttemptLimit(this IServiceCollection services, int permitsPerMinute)
    {
        services.AddRateLimiter(options =>
        {
            options.AddPolicy(AttemptsPolicy, context => HttpMethods.IsGet(context.Request.Method)
                ? RateLimitPartition.GetNoLimiter("reads")
                : RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = permitsPerMinute, Window = TimeSpan.FromMinutes(1) }));

            options.OnRejected = async (rejected, cancellationToken) =>
            {
                var response = rejected.HttpContext.Response;
                response.StatusCode = StatusCodes.Status429TooManyRequests;
                if (rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(System.Globalization.CultureInfo.InvariantCulture);

                await rejected.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = rejected.HttpContext,
                    ProblemDetails = { Status = StatusCodes.Status429TooManyRequests, Title = "Too many attempts. Wait a minute, then try again." },
                });
            };
        });
    }

    /// <summary>Maps the account endpoints under <c>/api/v1/account</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/account").WithTags("Account").RequireRateLimiting(AttemptsPolicy);

        group.MapIdentityApi<IdentityUser>().Add(ServeOnlyWhatTheAppUses);

        group.MapPost("/logout", SignOut)
            .WithName("SignOut")
            .WithSummary("Sign out, ending the session cookie.");

        group.MapPost("/password", ChangePassword)
            .RequireAuthorization()
            .WithName("ChangePassword")
            .WithSummary("Change your password. Needs the current one; keeps this session and ends every other.")
            .ProducesValidationProblem();

        group.MapDelete("/", DeleteAccount)
            .RequireAuthorization()
            .WithName("DeleteAccount")
            .WithSummary("Delete your account and everything saved in it, then sign out. Needs your password.")
            .ProducesValidationProblem();

        return routes;
    }

    /// <summary>
    /// Narrows Identity's built-in endpoints to the ones this app uses. Bearer-token refresh, two-factor setup and
    /// changing the account through <c>POST manage/info</c> (which skips the lockout check; <c>POST password</c> is the
    /// way to change a password) answer 404 and leave the API document. Signing in is with a session cookie only, so
    /// the login endpoint refuses to hand out a bearer token, which a script could read and keep.
    /// </summary>
    private static void ServeOnlyWhatTheAppUses(EndpointBuilder endpoint)
    {
        if (endpoint is not RouteEndpointBuilder route) return;
        var path = route.RoutePattern.RawText ?? "";
        var isPost = route.Metadata.OfType<HttpMethodMetadata>().Any(m => m.HttpMethods.Contains(HttpMethods.Post));

        if (path.EndsWith("/refresh", StringComparison.Ordinal) || path.EndsWith("/manage/2fa", StringComparison.Ordinal)
            || (path.EndsWith("/manage/info", StringComparison.Ordinal) && isPost))
        {
            // Replacing the handler before the endpoint is built keeps Identity's own from ever running.
            route.RequestDelegate = context =>
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return Task.CompletedTask;
            };
            route.Metadata.Add(new ExcludeFromDescriptionAttribute());
        }
        else if (path.EndsWith("/login", StringComparison.Ordinal))
        {
            route.FilterFactories.Add((_, next) => invocation =>
                invocation.HttpContext.Request.Query["useCookies"] == "true"
                    ? next(invocation)
                    : ValueTask.FromResult<object?>(TypedResults.Problem(
                        statusCode: StatusCodes.Status400BadRequest,
                        title: "Sign in with useCookies=true: this API keeps sessions in a cookie and issues no bearer tokens.")));
        }
    }

    /// <summary>The signed-in user's id, as the owner of what they save.</summary>
    /// <param name="user">The request's user; endpoints that call this require authorization.</param>
    /// <returns>The user's id.</returns>
    public static string OwnerId(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("The user has no id claim; the endpoint must require authorization.");

    private static async Task<NoContent> SignOut(SignInManager<IdentityUser> signInManager)
    {
        await signInManager.SignOutAsync();
        return TypedResults.NoContent();
    }

    /// <summary>
    /// Changes the signed-in user's password, once the current one is confirmed. A wrong current password counts toward
    /// lockout, as on the delete endpoint. Changing the password changes the security stamp, which ends the account's
    /// other sessions; this one is signed in again with the new stamp, so it carries on.
    /// </summary>
    private static async Task<Results<NoContent, ValidationProblem, UnauthorizedHttpResult>> ChangePassword(
        [FromBody] ChangePasswordRequest request, ClaimsPrincipal principal, UserManager<IdentityUser> users, SignInManager<IdentityUser> signIn)
    {
        var user = await users.GetUserAsync(principal);
        if (user is null)
            return TypedResults.Unauthorized();

        var check = await signIn.CheckPasswordSignInAsync(user, request.CurrentPassword ?? "", lockoutOnFailure: true);
        if (!check.Succeeded)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["currentPassword"] = [check.IsLockedOut ? "Too many wrong passwords. Wait a few minutes, then try again." : "The password is not correct."],
            });

        var changed = await users.ChangePasswordAsync(user, request.CurrentPassword!, request.NewPassword ?? "");
        if (!changed.Succeeded)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["newPassword"] = [.. changed.Errors.Select(e => e.Description)],
            });

        await signIn.RefreshSignInAsync(user);
        return TypedResults.NoContent();
    }

    /// <summary>
    /// Deletes the signed-in user, once their password is confirmed. Their saved calculations go with them (the
    /// database cascades the delete), and the session ends. A wrong password counts toward lockout like a failed
    /// sign-in, so a stolen session cannot be used to guess the password here.
    /// </summary>
    private static async Task<Results<NoContent, ValidationProblem, UnauthorizedHttpResult>> DeleteAccount(
        [FromBody] DeleteAccountRequest request, ClaimsPrincipal principal, UserManager<IdentityUser> users, SignInManager<IdentityUser> signIn)
    {
        var user = await users.GetUserAsync(principal);
        if (user is null)
            return TypedResults.Unauthorized();

        var check = await signIn.CheckPasswordSignInAsync(user, request.Password ?? "", lockoutOnFailure: true);
        if (!check.Succeeded)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["password"] = [check.IsLockedOut ? "Too many wrong passwords. Wait a few minutes, then try again." : "The password is not correct."],
            });

        var deleted = await users.DeleteAsync(user);
        if (!deleted.Succeeded)
            throw new InvalidOperationException($"Deleting the account failed: {string.Join("; ", deleted.Errors.Select(e => e.Description))}");

        await signIn.SignOutAsync();
        return TypedResults.NoContent();
    }
}

/// <summary>What changing the password needs: the current one, so an open session alone cannot change it.</summary>
/// <param name="CurrentPassword">The account's current password.</param>
/// <param name="NewPassword">The new password: 8 or more characters with a digit.</param>
public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

/// <summary>What deleting an account needs: the account's password, so an open session alone cannot delete it.</summary>
/// <param name="Password">The account's current password.</param>
public sealed record DeleteAccountRequest(string? Password);
