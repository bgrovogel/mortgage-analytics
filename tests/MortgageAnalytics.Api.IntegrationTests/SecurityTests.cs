using System.Net;
using System.Net.Http.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Hardening that applies across endpoints: the browser security headers on every response, and a limit on
/// account attempts (sign-in, sign-up, emailed links) per client, so a script can't guess passwords at speed or
/// flood someone's inbox.
/// </summary>
[TestFixture]
public class SecurityTests : ApiTestBase
{
    [TestCase("/health")]
    [TestCase("/api/v1/does-not-exist")]
    public async Task EveryResponse_TellsTheBrowserToLockThePageDown(string path)
    {
        var response = await Client.GetAsync(path);
        var policy = response.Headers.GetValues("Content-Security-Policy").Single();

        Assert.Multiple(() =>
        {
            Assert.That(policy, Does.Contain("script-src 'self'"), "scripts only from the app itself, never inline or injected");
            Assert.That(policy, Does.Contain("frame-ancestors 'none'"), "no other site can frame the app (clickjacking)");
            Assert.That(policy, Does.Contain("object-src 'none'"), "no plugins");
            Assert.That(response.Headers.GetValues("X-Content-Type-Options"), Is.EqualTo(new[] { "nosniff" }), "files are only what their type says");
            Assert.That(response.Headers.GetValues("X-Frame-Options"), Is.EqualTo(new[] { "DENY" }), "framing refused for older browsers too");
            Assert.That(response.Headers.GetValues("Referrer-Policy"), Is.EqualTo(new[] { "no-referrer" }),
                "reset and confirmation links carry codes in the URL, so the URL is never sent on to another site");
        });
    }

    [Test]
    public async Task TooManyAccountAttempts_AreRefused_WithWhenToTryAgain()
    {
        using var factory = new MortgageApiFactory(settings: new() { ["RateLimiting:AccountPermitsPerMinute"] = "2" });
        using var client = factory.CreateClient();

        var attempts = new List<HttpResponseMessage>();
        for (var i = 0; i < 3; i++)
            attempts.Add(await client.PostAsJsonAsync($"{AccountUrl}/forgotPassword", new { email = UniqueEmail() }));

        Assert.Multiple(() =>
        {
            Assert.That(attempts.Take(2).Select(a => a.StatusCode), Is.All.EqualTo(HttpStatusCode.OK), "attempts within the limit go through");
            Assert.That(attempts[2].Headers.RetryAfter?.Delta, Is.GreaterThan(TimeSpan.Zero), "the refusal says when to try again");
        });
        await AssertProblemAsync(attempts[2], HttpStatusCode.TooManyRequests, "the third attempt in a minute is over the limit");
    }

    [Test]
    public async Task TheLimit_LeavesReadsAndCalculationsAlone()
    {
        using var factory = new MortgageApiFactory(settings: new() { ["RateLimiting:AccountPermitsPerMinute"] = "1" });
        using var client = factory.CreateClient();

        var whoAmI = new List<HttpStatusCode>();
        var calculations = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            whoAmI.Add((await client.GetAsync($"{AccountUrl}/manage/info")).StatusCode);
            calculations.Add((await PostCalculateAsync(A.Request.Build(), client)).StatusCode);
        }

        Assert.Multiple(() =>
        {
            Assert.That(whoAmI, Is.All.EqualTo(HttpStatusCode.Unauthorized), "the app asks who is signed in on every load; that is never limited");
            Assert.That(calculations, Is.All.EqualTo(HttpStatusCode.OK), "the calculators are not account attempts");
        });
    }
}
