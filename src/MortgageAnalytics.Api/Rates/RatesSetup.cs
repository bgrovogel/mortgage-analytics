using Microsoft.Extensions.Options;
using MortgageAnalytics.Application.Rates;

namespace MortgageAnalytics.Api.Rates;

/// <summary>What the average rates are read from, set under <c>Rates</c>.</summary>
public sealed class RatesOptions
{
    /// <summary>The weekly survey's history, as Freddie Mac publishes it.</summary>
    public const string FreddieMacUrl = "https://www.freddiemac.com/pmms/docs/PMMS_history.csv";

    /// <summary>False for a deployment that must not call out: there are then no average rates, and the app carries on without.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Where to read the survey.</summary>
    public string SourceUrl { get; set; } = FreddieMacUrl;

    /// <summary>How long to wait for it before giving up, so a page never waits on another site.</summary>
    public int TimeoutSeconds { get; set; } = 5;
}

/// <summary>Wires up the average rates.</summary>
public static class RatesSetup
{
    /// <summary>Registers the source of the average rates, and its settings.</summary>
    /// <param name="services">The container to add to.</param>
    /// <param name="configuration">The app's configuration.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddAverageRates(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RatesOptions>(configuration.GetSection("Rates"));
        // One instance for the whole app, because it holds the rates it has read for every request to share. Its connections
        // are renewed every few minutes, as a client kept this long should, so a changed address is followed. It sends nothing of the visitor's.
        services.AddSingleton<IAverageRates>(sp =>
        {
            var client = new HttpClient(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(15) }) { MaxResponseContentBufferSize = 5_000_000 };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("MortgageAnalytics/1.0");
            return new FreddieMacAverageRates(client, sp.GetRequiredService<TimeProvider>(), sp.GetRequiredService<IOptions<RatesOptions>>());
        });
        return services;
    }
}
