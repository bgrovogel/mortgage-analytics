using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace MortgageAnalytics.Api.IntegrationTests.Infrastructure;

/// <summary>
/// Hosts the real API in memory for tests. The environment is pinned to Production so tests see the
/// same error handling as a deployment, and the clock is frozen so date defaults are deterministic.
/// Each host gets its own SQLite file, built by the real migrations and deleted when the host is disposed.
/// </summary>
/// <param name="configureServices">Optional extra registrations, e.g. a substitute service for error-path tests.</param>
public sealed class MortgageApiFactory(Action<IServiceCollection>? configureServices = null) : WebApplicationFactory<Program>
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"mortgage-analytics-tests-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting("ConnectionStrings:Calculations", $"Data Source={_databasePath}");
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<TimeProvider>(TestClock.Create());
            configureServices?.Invoke(services);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing)
            return;

        // Pooled connections keep the file open on Windows, so close them before deleting it.
        SqliteConnection.ClearAllPools();
        File.Delete(_databasePath);
    }
}
