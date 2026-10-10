using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace MortgageAnalytics.Api.IntegrationTests.Infrastructure;

/// <summary>Base class for API tests: the shared client plus request and ProblemDetails helpers.</summary>
public abstract class ApiTestBase
{
    /// <summary>The calculate endpoint.</summary>
    protected const string CalculateUrl = "/api/v1/amortization/calculate";

    /// <summary>The saved-calculations collection.</summary>
    protected const string CalculationsUrl = "/api/v1/calculations";

    /// <summary>The account endpoints.</summary>
    protected const string AccountUrl = "/api/v1/account";

    /// <summary>A password that meets the rules (8+ characters with a digit).</summary>
    protected const string GoodPassword = "correct-horse-1";

    /// <summary>A client for the shared in-memory API.</summary>
    protected static HttpClient Client => ApiFixture.Client;

    /// <summary>Posts <paramref name="body"/> as JSON to the calculate endpoint, with an optional query string.</summary>
    protected static Task<HttpResponseMessage> PostCalculateAsync(object body, HttpClient? client = null, string query = "") =>
        (client ?? Client).PostAsJsonAsync(CalculateUrl + query, body);

    /// <summary>Posts raw text as JSON, for malformed-body tests.</summary>
    protected static Task<HttpResponseMessage> PostRawAsync(string json) =>
        Client.PostAsync(CalculateUrl, new StringContent(json, Encoding.UTF8, "application/json"));

    /// <summary>A unique email, so tests on the shared host never collide.</summary>
    protected static string UniqueEmail() => $"user-{Guid.NewGuid():N}@example.com";

    /// <summary>
    /// Registers a new user and signs in with a session cookie, the way the browser does. The returned
    /// client keeps the cookie, so every request it makes is that user's.
    /// </summary>
    protected static async Task<HttpClient> SignUpAsync(string? email = null)
    {
        email ??= UniqueEmail();
        var client = ApiFixture.Factory.CreateClient(); // handles cookies by default
        await EnsureSucceededAsync(await client.PostAsJsonAsync($"{AccountUrl}/register", new { email, password = GoodPassword }), "registering");
        await EnsureSucceededAsync(await client.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword }), "signing in");
        return client;
    }

    /// <summary>Stops a test whose setup failed, showing the response body. Setup is not what the test asserts.</summary>
    private static async Task EnsureSucceededAsync(HttpResponseMessage response, string step)
    {
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Test setup failed while {step}: {(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");
    }

    /// <summary>Reads the response body as a JSON document root.</summary>
    protected static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return document.RootElement.Clone();
    }

    /// <summary>
    /// Asserts that <paramref name="response"/> is an RFC 9457 problem with the expected status.
    /// The body is included in the failure message, so a failure shows what actually came back.
    /// </summary>
    protected static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode expected, string because)
    {
        var body = await response.Content.ReadAsStringAsync();

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(expected), $"{because}; body: {body}");
            Assert.That(response.Content.Headers.ContentType?.MediaType, Is.EqualTo("application/problem+json"), $"errors are ProblemDetails; body: {body}");
        });
    }
}
