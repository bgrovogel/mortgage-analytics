using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// The health endpoint asks this layer whether the database answers, so a container whose database volume is
/// missing or broken reports itself unhealthy instead of serving errors while looking fine.
/// </summary>
[TestFixture]
public class DatabaseHealthCheckTests
{
    [Test]
    public async Task TheDatabaseTheAppCreated_IsHealthy()
    {
        var path = Path.Combine(Path.GetTempPath(), $"health-{Guid.NewGuid():N}.db");
        try
        {
            // As at startup: the app creates the database (or brings it up to date) before taking requests.
            await using (var app = Services($"Data Source={path}"))
                await app.MigrateDatabaseAsync();

            var report = await CheckAsync($"Data Source={path}");

            Assert.That(report.Status, Is.EqualTo(HealthStatus.Healthy), "the database exists and can be opened");
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(path);
        }
    }

    [Test]
    public async Task AMissingDatabase_IsUnhealthy()
    {
        var missing = Path.Combine(Path.GetTempPath(), $"no-such-folder-{Guid.NewGuid():N}", "calculations.db");

        var report = await CheckAsync($"Data Source={missing}");

        Assert.That(report.Status, Is.EqualTo(HealthStatus.Unhealthy), "a missing database volume must show up in the health check");
    }

    private static ServiceProvider Services(string connectionString) =>
        new ServiceCollection().AddLogging().AddInfrastructure(connectionString).BuildServiceProvider();

    private static async Task<HealthReport> CheckAsync(string connectionString)
    {
        await using var services = Services(connectionString);
        return await services.GetRequiredService<HealthCheckService>().CheckHealthAsync();
    }
}
