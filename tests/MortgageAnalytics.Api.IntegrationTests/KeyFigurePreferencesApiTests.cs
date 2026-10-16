using System.Net;
using System.Net.Http.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>The key-figure arrangement endpoints, end to end as signed-in users: each user has their own.</summary>
[TestFixture]
public class KeyFigurePreferencesApiTests : ApiTestBase
{
    private const string Url = "/api/v1/account/key-figures";

    private static string[] Names(System.Text.Json.JsonElement list) => [.. list.EnumerateArray().Select(e => e.GetString()!)];

    [Test]
    public async Task ANewUser_HasNoArrangement()
    {
        using var me = await SignUpAsync();

        var body = await ReadJsonAsync(await me.GetAsync(Url));

        Assert.Multiple(() =>
        {
            Assert.That(Names(body.GetProperty("order")), Is.Empty, "nothing chosen yet");
            Assert.That(Names(body.GetProperty("hidden")), Is.Empty, "and nothing put away");
        });
    }

    [Test]
    public async Task AnArrangement_IsKept_AndComesBackInTheSameOrder()
    {
        using var me = await SignUpAsync();

        var put = await me.PutAsJsonAsync(Url, new { order = new[] { "payoff", "cash", "pmi" }, hidden = new[] { "pmi" } });
        var body = await ReadJsonAsync(await me.GetAsync(Url));

        Assert.Multiple(() =>
        {
            Assert.That(put.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "saved, with nothing to say back");
            Assert.That(Names(body.GetProperty("order")), Is.EqualTo(new[] { "payoff", "cash", "pmi" }), "in the user's order");
            Assert.That(Names(body.GetProperty("hidden")), Is.EqualTo(new[] { "pmi" }), "with what they put away");
        });
    }

    [Test]
    public async Task EachUser_HasTheirOwn()
    {
        using var alice = await SignUpAsync();
        using var bob = await SignUpAsync();
        await alice.PutAsJsonAsync(Url, new { order = new[] { "cash" }, hidden = Array.Empty<string>() });

        var bobs = await ReadJsonAsync(await bob.GetAsync(Url));

        Assert.That(Names(bobs.GetProperty("order")), Is.Empty, "Bob sees nothing of Alice's choice");
    }

    [Test]
    public async Task AnArrangement_ThatIsNotNames_IsRejected()
    {
        using var me = await SignUpAsync();

        var response = await me.PutAsJsonAsync(Url, new { order = new[] { "Not A Name" }, hidden = Array.Empty<string>() });

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "only short lowercase names are kept");
    }

    [Test]
    public async Task WithoutAnAccount_BothAreRefused()
    {
        var get = await Client.GetAsync(Url);
        var put = await Client.PutAsJsonAsync(Url, new { order = Array.Empty<string>(), hidden = Array.Empty<string>() });

        Assert.Multiple(() =>
        {
            Assert.That(get.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "reading needs an account");
            Assert.That(put.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "and so does saving");
        });
    }
}
