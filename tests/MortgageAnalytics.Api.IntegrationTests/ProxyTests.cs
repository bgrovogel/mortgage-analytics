using System.Net;
using System.Net.Http.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Behind a reverse proxy that ends HTTPS. The proxy's <c>X-Forwarded-*</c> headers are believed only from the
/// proxies the configuration names: then a request that arrived over HTTPS is HTTPS here (so the session cookie is
/// <c>Secure</c> and HSTS is sent), and the attempt limit counts each real client, not the proxy. From anyone else
/// the headers are ignored, so they cannot be used to dodge the limit or fake HTTPS.
/// </summary>
[TestFixture]
public class ProxyTests : ApiTestBase
{
    private const string Proxy = "10.0.0.5";
    private const string Stranger = "203.0.113.9";

    private static MortgageApiFactory BehindAProxy(int attemptsPerMinute = 10_000) => new(settings: new()
    {
        ["ForwardedHeaders:KnownNetworks:0"] = "10.0.0.0/8",
        ["RateLimiting:AccountPermitsPerMinute"] = attemptsPerMinute.ToString(System.Globalization.CultureInfo.InvariantCulture),
    });

    [Test]
    public async Task OverHttpsAtTheProxy_TheSessionCookieIsSecure_AndHstsIsSent()
    {
        using var host = BehindAProxy();
        var email = UniqueEmail();
        await RegisterAndConfirmAsync(host, email);

        var login = await SendAsync(host, HttpMethod.Post, $"{AccountUrl}/login?useCookies=true", from: Proxy, proto: "https",
            body: new { email, password = GoodPassword });

        Assert.Multiple(() =>
        {
            Assert.That(CookieOf(login), Does.Contain("secure"), "the browser only ever sends the session over HTTPS");
            Assert.That(login.Headers.Contains("Strict-Transport-Security"), Is.True, "and is told to keep to HTTPS");
        });
    }

    [Test]
    public async Task FromAnyoneElse_TheHeadersAreIgnored()
    {
        using var host = BehindAProxy();
        var email = UniqueEmail();
        await RegisterAndConfirmAsync(host, email);

        var login = await SendAsync(host, HttpMethod.Post, $"{AccountUrl}/login?useCookies=true", from: Stranger, proto: "https",
            body: new { email, password = GoodPassword });

        Assert.Multiple(() =>
        {
            Assert.That(CookieOf(login), Does.Not.Contain("secure"), "a plain-HTTP request cannot claim HTTPS");
            Assert.That(login.Headers.Contains("Strict-Transport-Security"), Is.False, "and gets no HSTS");
        });
    }

    [Test]
    public async Task TheAttemptLimit_CountsEachClientBehindTheProxy()
    {
        using var host = BehindAProxy(attemptsPerMinute: 1);

        var first = await ForgotPasswordAsync(host, from: Proxy, client: "198.51.100.1");
        var again = await ForgotPasswordAsync(host, from: Proxy, client: "198.51.100.1");
        var someoneElse = await ForgotPasswordAsync(host, from: Proxy, client: "198.51.100.2");

        Assert.Multiple(() =>
        {
            Assert.That(first.StatusCode, Is.EqualTo(HttpStatusCode.OK), "a client's first attempt goes through");
            Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.TooManyRequests), "its second, in the same minute, is over its limit");
            Assert.That(someoneElse.StatusCode, Is.EqualTo(HttpStatusCode.OK), "another client behind the same proxy has a limit of its own");
        });
    }

    [Test]
    public async Task AStrangerCannotDodgeTheLimit_ByClaimingToBeSomeoneElse()
    {
        using var host = BehindAProxy(attemptsPerMinute: 1);

        await ForgotPasswordAsync(host, from: Stranger, client: "198.51.100.1");
        var faked = await ForgotPasswordAsync(host, from: Stranger, client: "198.51.100.2");

        Assert.That(faked.StatusCode, Is.EqualTo(HttpStatusCode.TooManyRequests), "an untrusted X-Forwarded-For changes nothing");
    }

    private static Task<HttpResponseMessage> ForgotPasswordAsync(MortgageApiFactory host, string from, string client) =>
        SendAsync(host, HttpMethod.Post, $"{AccountUrl}/forgotPassword", from, client: client, body: new { email = UniqueEmail() });

    /// <summary>Sends a request as if from <paramref name="from"/>, with the headers a proxy adds.</summary>
    private static async Task<HttpResponseMessage> SendAsync(
        MortgageApiFactory host, HttpMethod method, string url, string from, string? proto = null, string? client = null, object? body = null)
    {
        using var http = host.CreateClient();
        // Not "localhost", which HSTS leaves out so a developer's other local sites keep working over HTTP.
        var request = new HttpRequestMessage(method, url) { Content = body is null ? null : JsonContent.Create(body) };
        request.Headers.Host = "mortgage.example.com";
        request.Headers.Add(MortgageApiFactory.RemoteAddressHeader, from);
        if (proto is not null)
            request.Headers.Add("X-Forwarded-Proto", proto);
        if (client is not null)
            request.Headers.Add("X-Forwarded-For", client);
        return await http.SendAsync(request);
    }

    private static async Task RegisterAndConfirmAsync(MortgageApiFactory host, string email)
    {
        using var client = host.CreateClient();
        await client.PostAsJsonAsync($"{AccountUrl}/register", new { email, password = GoodPassword });
        await ConfirmEmailAsync(client, email, host);
    }

    private static string CookieOf(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Set-Cookie", out var cookies)
            ? cookies.Single(c => c.StartsWith("mortgage-analytics.session=", StringComparison.Ordinal)).ToLowerInvariant()
            : throw new InvalidOperationException($"No cookie was set: {(int)response.StatusCode}");
}
