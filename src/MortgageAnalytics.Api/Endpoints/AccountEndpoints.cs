using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using MortgageAnalytics.Infrastructure;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>
/// User accounts, with ASP.NET Core Identity: its built-in endpoints (register, login, account info)
/// under <c>/api/v1/account</c>, plus sign-out. The browser signs in with <c>login?useCookies=true</c> and
/// then carries an HttpOnly, SameSite=Strict session cookie, which scripts cannot read and other sites
/// cannot send.
/// </summary>
public static class AccountEndpoints
{
    /// <summary>Registers Identity, its password rules and the session cookie.</summary>
    /// <param name="services">The container to add to.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddAccounts(this IServiceCollection services)
    {
        services.AddAuthorization();
        services
            .AddIdentityApiEndpoints<IdentityUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
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

        return services;
    }

    /// <summary>Maps the account endpoints under <c>/api/v1/account</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/account").WithTags("Account");

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
