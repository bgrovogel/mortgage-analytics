using System.Net;
using System.Net.Http.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// The development mailbox: with no mail server configured, emails are written to a local outbox, and in
/// Development the app can list them so a local demo works end to end. It must not exist in Production,
/// because it shows every user's links.
/// </summary>
[TestFixture]
public class DevOutboxTests : ApiTestBase
{
    private const string OutboxUrl = "/api/v1/dev/outbox";

    [Test]
    public async Task InProduction_ThereIsNoMailbox()
    {
        var response = await Client.GetAsync(OutboxUrl);

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "other people's confirmation and reset links must never be exposed");
    }

    [Test]
    public async Task InDevelopment_EmailsGoToTheOutbox_AndTheMailboxListsThemNewestFirst()
    {
        // The real file outbox this time, not the capturing substitute.
        using var factory = new MortgageApiFactory(environment: "Development", captureMail: false);
        using var client = factory.CreateClient();
        var first = UniqueEmail();
        var second = UniqueEmail();
        await client.PostAsJsonAsync($"{AccountUrl}/register", new { email = first, password = GoodPassword });
        await client.PostAsJsonAsync($"{AccountUrl}/register", new { email = second, password = GoodPassword });

        var mailbox = await ReadJsonAsync(await client.GetAsync(OutboxUrl));
        var recipients = mailbox.EnumerateArray().Select(m => m.GetProperty("to").GetString()).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(recipients, Is.EqualTo(new[] { second, first }), "every email, newest first");
            Assert.That(mailbox[0].GetProperty("actionUrl").GetString(), Does.Contain("/confirm-email?"), "with the link ready to follow");
        });
    }

    [Test]
    public async Task InDevelopment_TheMailboxCanBeCleared_ForAFreshDemo()
    {
        using var factory = new MortgageApiFactory(environment: "Development", captureMail: false);
        using var client = factory.CreateClient();
        await client.PostAsJsonAsync($"{AccountUrl}/register", new { email = UniqueEmail(), password = GoodPassword });

        var cleared = await client.DeleteAsync(OutboxUrl);
        var mailbox = await ReadJsonAsync(await client.GetAsync(OutboxUrl));

        Assert.Multiple(() =>
        {
            Assert.That(cleared.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "clearing succeeds");
            Assert.That(mailbox.GetArrayLength(), Is.Zero, "and the mailbox is empty");
        });
    }

    [Test]
    public async Task InProduction_TheMailboxCannotBeCleared()
    {
        var response = await Client.DeleteAsync(OutboxUrl);

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "the endpoint does not exist outside Development");
    }
}
