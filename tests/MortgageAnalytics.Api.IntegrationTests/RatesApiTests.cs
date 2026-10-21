using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;
using MortgageAnalytics.Application.Rates;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>The average mortgage rates endpoint: what the survey says this week, or that it cannot say. Anyone may ask.</summary>
[TestFixture]
public class RatesApiTests : ApiTestBase
{
    private const string AverageUrl = "/api/v1/rates/average";

    private sealed class FixedRates(AverageRates? rates) : IAverageRates
    {
        public Task<AverageRates?> GetAsync(CancellationToken cancellationToken) => Task.FromResult(rates);
    }

    private static MortgageApiFactory HostWith(AverageRates? rates) =>
        new(services => services.AddSingleton<IAverageRates>(new FixedRates(rates)));

    [Test]
    public async Task TheAverageRates_AreAnsweredToAnyone_WithTheWeekAndTheirSource()
    {
        using var host = HostWith(new AverageRates(new DateOnly(2026, 10, 15), 7.41m, 6.71m));
        using var client = host.CreateClient();

        var response = await client.GetAsync(AverageUrl);
        var body = await ReadJsonAsync(response);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "no account is needed to read a published average");
            Assert.That(body.GetProperty("asOf").GetString(), Is.EqualTo("2026-10-15"), "the week they are for");
            Assert.That(body.GetProperty("thirtyYearFixed").GetDecimal(), Is.EqualTo(7.41m), "the 30-year average");
            Assert.That(body.GetProperty("fifteenYearFixed").GetDecimal(), Is.EqualTo(6.71m), "the 15-year average");
            Assert.That(body.GetProperty("source").GetString(), Does.Contain("Freddie Mac"), "where they come from, so the page can say so");
        });
    }

    [Test]
    public async Task WithoutRates_ItIsA204WithNoBody_NotAnError()
    {
        using var host = HostWith(null);
        using var client = host.CreateClient();

        var response = await client.GetAsync(AverageUrl);

        Assert.Multiple(async () =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "the survey cannot be reached, which is nobody's mistake: no error for the browser to log on every page");
            Assert.That(await response.Content.ReadAsStringAsync(), Is.Empty, "and nothing in the body");
        });
    }

    [Test]
    public async Task TheSharedHost_NeverCallsOut()
    {
        var response = await Client.GetAsync(AverageUrl);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "tests run with the survey switched off, so they need no network");
    }
}
