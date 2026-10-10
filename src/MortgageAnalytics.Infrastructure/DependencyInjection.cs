using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Application.SavedCalculations;

namespace MortgageAnalytics.Infrastructure;

/// <summary>Registers this layer's storage with the dependency-injection container.</summary>
public static class DependencyInjection
{
    /// <summary>Registers the SQLite database and the repository the application layer asks for.</summary>
    /// <param name="services">The container to add to.</param>
    /// <param name="connectionString">A SQLite connection string, e.g. <c>Data Source=calculations.db</c>.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<CalculationsDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<ISavedCalculationRepository, SavedCalculationRepository>();
        return services;
    }

    /// <summary>
    /// Creates the database, or brings it up to date, by applying any migrations it has not had yet.
    /// The app calls this once at startup, before it takes requests.
    /// </summary>
    /// <param name="services">The app's root service provider.</param>
    /// <param name="cancellationToken">Cancels the migration.</param>
    /// <returns>A task that completes once the database is current.</returns>
    public static async Task MigrateDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<CalculationsDbContext>().Database.MigrateAsync(cancellationToken);
    }
}
