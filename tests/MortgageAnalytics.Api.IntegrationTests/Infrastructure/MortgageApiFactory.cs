using System.Collections.Concurrent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using MortgageAnalytics.Api.Email;

namespace MortgageAnalytics.Api.IntegrationTests.Infrastructure;

/// <summary>
/// Hosts the real API in memory for tests. The environment is pinned (Production by default) so tests see
/// the same error handling as a deployment, and the clock is frozen so date defaults are deterministic.
/// Each host gets its own SQLite file, built by the real migrations and deleted when the host is disposed.
/// Outgoing email goes to an NSubstitute transport that records it in <see cref="SentMail"/>.
/// </summary>
/// <param name="configureServices">Optional extra registrations, e.g. a substitute service for error-path tests.</param>
/// <param name="environment">The hosting environment; "Development" turns on development-only endpoints.</param>
/// <param name="captureMail">True to record email in <see cref="SentMail"/>; false to use the app's own transport.</param>
/// <param name="settings">Configuration to override, e.g. a lower account rate limit.</param>
public sealed class MortgageApiFactory(
    Action<IServiceCollection>? configureServices = null, string environment = "Production", bool captureMail = true,
    Dictionary<string, string>? settings = null)
    : WebApplicationFactory<Program>
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"mortgage-analytics-tests-{Guid.NewGuid():N}.db");
    private readonly string _appDataPath = Path.Combine(Path.GetTempPath(), $"mortgage-analytics-tests-{Guid.NewGuid():N}");

    /// <summary>Every email the API has sent, in order.</summary>
    public ConcurrentQueue<EmailMessage> SentMail { get; } = new();

    /// <summary>Everything the API has logged, with its scopes.</summary>
    public CapturedLogs Logs { get; } = new();

    /// <summary>The app's clock, frozen at <see cref="TestClock.Now"/>; a test that needs time to pass advances it.</summary>
    public FakeTimeProvider Clock { get; } = TestClock.Create();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        // Everything, Debug included, so tests can read what each level would show (the console keeps its own levels).
        builder.ConfigureLogging(logging => logging.AddProvider(Logs).AddFilter<CapturedLogs>(null, LogLevel.Debug));
        builder.UseSetting("ConnectionStrings:Calculations", $"Data Source={_databasePath}");
        builder.UseSetting("DataProtection:KeysDirectory", Path.Combine(_appDataPath, "keys"));
        builder.UseSetting("Email:OutboxDirectory", Path.Combine(_appDataPath, "outbox"));
        // The whole suite signs up and in from one address; the limit itself is tested with its own host.
        builder.UseSetting("RateLimiting:AccountPermitsPerMinute", "10000");
        foreach (var (key, value) in settings ?? [])
            builder.UseSetting(key, value);
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<TimeProvider>(Clock);

            if (captureMail)
            {
                var transport = Substitute.For<IMailTransport>();
                transport.SendAsync(Arg.Do<EmailMessage>(SentMail.Enqueue), Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
                services.AddSingleton(transport);
            }

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
        if (Directory.Exists(_appDataPath))
            Directory.Delete(_appDataPath, recursive: true);
    }
}
