using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using MortgageAnalytics.Infrastructure;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>
/// User accounts, with ASP.NET Core Identity: its built-in endpoints (register, confirm email, login,
/// forgot and reset password, account info) under <c>/api/v1/account</c>, plus sign-out. The browser signs in with <c>login?useCookies=true</c> and
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

        group.MapIdentityApi<IdentityUser>();

        group.MapPost("/logout", SignOut)
            .WithName("SignOut")
            .WithSummary("Sign out, ending the session cookie.");

        return routes;
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
}
