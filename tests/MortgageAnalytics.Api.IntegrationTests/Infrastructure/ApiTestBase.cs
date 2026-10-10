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

    /// <summary>A client for the shared in-memory API.</summary>
    protected static HttpClient Client => ApiFixture.Client;

    /// <summary>Posts <paramref name="body"/> as JSON to the calculate endpoint, with an optional query string.</summary>
    protected static Task<HttpResponseMessage> PostCalculateAsync(object body, HttpClient? client = null, string query = "") =>
        (client ?? Client).PostAsJsonAsync(CalculateUrl + query, body);

    /// <summary>Posts raw text as JSON, for malformed-body tests.</summary>
    protected static Task<HttpResponseMessage> PostRawAsync(string json) =>
        Client.PostAsync(CalculateUrl, new StringContent(json, Encoding.UTF8, "application/json"));

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
