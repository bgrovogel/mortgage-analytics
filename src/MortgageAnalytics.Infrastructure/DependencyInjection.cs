using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Application.SavedCalculations;
using MortgageAnalytics.Infrastructure.Backups;

namespace MortgageAnalytics.Infrastructure;

/// <summary>Registers this layer's storage with the dependency-injection container.</summary>
public static class DependencyInjection
{
    /// <summary>
    /// Registers the SQLite database, the repository the application layer asks for, and a health check that the
    /// database answers (so <c>/health</c> reports a missing or broken database volume).
    /// </summary>
    /// <param name="services">The container to add to.</param>
    /// <param name="connectionString">A SQLite connection string, e.g. <c>Data Source=calculations.db</c>.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<CalculationsDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<ISavedCalculationRepository, SavedCalculationRepository>();
        services.AddHealthChecks().AddDbContextCheck<CalculationsDbContext>("database");
        return services;
    }

    /// <summary>
    /// Backs the database up automatically (<see cref="DatabaseBackupService"/>), as the <c>Backups</c> settings say:
    /// <c>Enabled</c> (default true), <c>Directory</c> (default a <c>backups</c> folder beside the database, on the same
    /// volume in Docker), <c>IntervalHours</c> (default 24) and <c>Keep</c> (default 7).
    /// </summary>
    /// <param name="services">The container to add to.</param>
    /// <param name="configuration">The app's configuration.</param>
    /// <param name="connectionString">The database's connection string, which says where the database file is.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddDatabaseBackups(this IServiceCollection services, IConfiguration configuration, string connectionString)
    {
        var section = configuration.GetSection("Backups");
        var database = Path.GetFullPath(new SqliteConnectionStringBuilder(connectionString).DataSource);
        var options = new BackupOptions(
            Enabled: !bool.TryParse(section["Enabled"], out var enabled) || enabled,
            Directory: section["Directory"] is { Length: > 0 } directory ? directory : Path.Combine(Path.GetDirectoryName(database)!, "backups"),
            Interval: TimeSpan.FromHours(double.TryParse(section["IntervalHours"], System.Globalization.CultureInfo.InvariantCulture, out var hours) ? hours : 24),
            Keep: int.TryParse(section["Keep"], out var keep) ? keep : 7);

        services.AddSingleton(options);
        services.AddSingleton<DatabaseBackup>();
        services.AddHostedService<DatabaseBackupService>();
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
