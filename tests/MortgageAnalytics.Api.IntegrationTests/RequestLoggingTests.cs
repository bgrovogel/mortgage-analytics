using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;
using NSubstitute.ExceptionExtensions;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Every request has an id: sent back in <c>X-Request-ID</c>, put in every error body, and on every log line written
/// while the request runs, so one failure can be followed from the browser to the logs. Each API request is logged
/// once, with its status and time, and never with its query string, which can hold emailed codes.
/// </summary>
[TestFixture]
public class RequestLoggingTests : ApiTestBase
{
    private const string Header = "X-Request-ID";

    [Test]
    public async Task EveryResponse_CarriesARequestId()
    {
        var first = await Client.GetAsync("/health");
        var second = await Client.GetAsync("/health");

        Assert.Multiple(() =>
        {
            Assert.That(first.Headers.TryGetValues(Header, out var a) ? a.Single() : "", Is.Not.Empty, "the response says which request it answers");
            Assert.That(second.Headers.GetValues(Header).Single(), Is.Not.EqualTo(first.Headers.GetValues(Header).Single()), "and each request has its own");
        });
    }

    [Test]
    public async Task ARequestIdFromTheCaller_IsKept_WhenItIsSafe()
    {
        var kept = await SendWithIdAsync("checkout-7f3a9c");
        var overlong = await SendWithIdAsync(new string('x', 200));
        var forged = await SendWithIdAsync("bad id\" injected=\"1");

        Assert.Multiple(() =>
        {
            Assert.That(kept.Headers.GetValues(Header).Single(), Is.EqualTo("checkout-7f3a9c"), "a proxy's or client's id is reused, so their logs and ours line up");
            Assert.That(overlong.Headers.GetValues(Header).Single(), Has.Length.LessThanOrEqualTo(64), "an overlong id is replaced");
            Assert.That(forged.Headers.GetValues(Header).Single(), Does.Not.Contain("\""), "and so is one that could forge a log field");
        });
    }

    [Test]
    public async Task AnErrorBody_NamesTheRequest()
    {
        var response = await Client.GetAsync("/api/v1/no-such-endpoint");

        var problem = await ReadJsonAsync(response);
        Assert.That(problem.GetProperty("requestId").GetString(), Is.EqualTo(response.Headers.GetValues(Header).Single()),
            "someone reporting an error can quote the id that finds it in the logs");
    }

    [Test]
    public async Task EachApiRequest_IsLoggedOnce_WithItsStatus_ButNotItsQueryString()
    {
        var response = await Client.GetAsync("/api/v1/calculations?code=emailed-secret");
        var id = response.Headers.GetValues(Header).Single();

        var lines = ApiFixture.Factory.Logs.Entries.Where(e => Equals(e.Values.GetValueOrDefault("RequestId"), id)).ToList();
        Assert.Multiple(() =>
        {
            Assert.That(lines, Has.Count.EqualTo(1), "one line per request");
            Assert.That(lines.Single().Message, Does.StartWith("GET /api/v1/calculations responded 401 in "), "method, path and status, readable at a glance");
            Assert.That(lines.Single().Level, Is.EqualTo(LogLevel.Information), "an API request is worth a line");
            Assert.That(lines.Single().Values.Keys, Is.SupersetOf(new[] { "Method", "Path", "StatusCode", "ElapsedMilliseconds" }), "and each part is a field to search on");
            Assert.That(lines.Single().Message, Does.Not.Contain("emailed-secret"), "the query string, which can hold emailed codes, is never logged");
        });
    }

    [Test]
    public async Task OtherRequests_AreLoggedOnlyWhenDebugging()
    {
        var response = await Client.GetAsync("/health");
        var id = response.Headers.GetValues(Header).Single();

        var line = ApiFixture.Factory.Logs.Entries.Single(e => Equals(e.Values.GetValueOrDefault("RequestId"), id));
        Assert.That(line.Level, Is.EqualTo(LogLevel.Debug), "health checks and static files would drown the API's lines");
    }

    [Test]
    public async Task AFailure_IsLoggedWithTheRequestId()
    {
        var service = Substitute.For<IAmortizationService>();
        service.Analyze(Arg.Any<AmortizationRequest>()).Throws(new InvalidOperationException("boom"));
        using var host = new MortgageApiFactory(services => services.AddSingleton(service));
        using var client = host.CreateClient();

        var response = await PostCalculateAsync(A.Request.Build(), client);
        var id = response.Headers.GetValues(Header).Single();

        var error = host.Logs.Entries.Single(e => e.Level == LogLevel.Error);
        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.InternalServerError), "the failure is a 500");
            Assert.That(error.ScopeValues.GetValueOrDefault("RequestId"), Is.EqualTo(id), "the exception's log entry carries the request's id");
        });
    }

    [TestCase("Production", "json", TestName = "Production writes JSON, for a log store to search")]
    [TestCase("Development", "simple", TestName = "Development writes plain lines, for a person to read")]
    public void ConsoleLogs_SuitWhoReadsThem(string environment, string formatter)
    {
        using var host = new MortgageApiFactory(environment: environment);

        var console = host.Services.GetRequiredService<IOptionsMonitor<ConsoleLoggerOptions>>().CurrentValue;
        var json = host.Services.GetRequiredService<IOptionsMonitor<JsonConsoleFormatterOptions>>().CurrentValue;
        Assert.Multiple(() =>
        {
            Assert.That(console.FormatterName, Is.EqualTo(formatter), $"{environment} logs as {formatter}");
            Assert.That(json.IncludeScopes, Is.True, "JSON lines carry the request id from the scope");
        });
    }

    private static Task<HttpResponseMessage> SendWithIdAsync(string id)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.TryAddWithoutValidation(Header, id);
        return Client.SendAsync(request);
    }
}
