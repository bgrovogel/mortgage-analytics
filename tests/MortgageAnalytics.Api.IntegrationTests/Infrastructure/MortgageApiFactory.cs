using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace MortgageAnalytics.Api.IntegrationTests.Infrastructure;

/// <summary>
/// Hosts the real API in memory for tests. The environment is pinned to Production so tests see the
/// same error handling as a deployment, and the clock is frozen so date defaults are deterministic.
/// </summary>
/// <param name="configureServices">Optional extra registrations, e.g. a substitute service for error-path tests.</param>
public sealed class MortgageApiFactory(Action<IServiceCollection>? configureServices = null) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<TimeProvider>(TestClock.Create());
            configureServices?.Invoke(services);
        });
    }
}
