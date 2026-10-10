using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;

namespace MortgageAnalytics.Api.Email;

/// <summary>Wires up account emails, and the development mailbox that makes them visible locally.</summary>
public static class EmailSetup
{
    /// <summary>
    /// Registers the account email sender, and SMTP when <c>Email:Smtp:Host</c> is set; otherwise the local
    /// outbox, so a local run needs no mail server.
    /// </summary>
    /// <param name="services">The container to add to.</param>
    /// <param name="configuration">The app's configuration.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddEmail(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<EmailOptions>(configuration.GetSection("Email"));
        services.AddHttpContextAccessor();
        services.AddSingleton<FileOutbox>();

        if (string.IsNullOrWhiteSpace(configuration["Email:Smtp:Host"]))
            services.AddSingleton<IMailTransport>(sp => sp.GetRequiredService<FileOutbox>());
        else
            services.AddSingleton<IMailTransport, SmtpMailTransport>();

        // Replaces Identity's default sender, which sends nothing.
        services.AddTransient<IEmailSender<IdentityUser>, AccountEmailSender>();
        return services;
    }

    /// <summary>
    /// Maps <c>GET /api/v1/dev/outbox</c> (every email in the local outbox, newest first) and
    /// <c>DELETE /api/v1/dev/outbox</c> (empty it). Call this only in Development: it shows every user's
    /// confirmation and reset links.
    /// </summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapDevOutbox(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/v1/dev/outbox", ReadOutbox)
            .WithTags("Development")
            .WithName("DevOutbox")
            .WithSummary("Development only: the emails the app has sent to the local outbox, newest first.");

        routes.MapDelete("/api/v1/dev/outbox", ClearOutbox)
            .WithTags("Development")
            .WithName("ClearDevOutbox")
            .WithSummary("Development only: empty the local outbox, e.g. before a demo.");
        return routes;
    }

    private static NoContent ClearOutbox(FileOutbox outbox)
    {
        outbox.Clear();
        return TypedResults.NoContent();
    }

    private static async Task<Ok<IReadOnlyList<EmailMessage>>> ReadOutbox(FileOutbox outbox, CancellationToken cancellationToken) =>
        TypedResults.Ok(await outbox.ReadAllAsync(cancellationToken));
}
