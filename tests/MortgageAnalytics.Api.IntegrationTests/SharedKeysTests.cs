using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Several instances of the app behind one load balancer. A session cookie is signed with the instance's keys, so the
/// next request, sent to another instance, is only still signed in when the instances share their keys. With
/// <c>DataProtection:Store = Database</c> they keep them in the database they already share.
/// </summary>
[TestFixture]
public class SharedKeysTests : ApiTestBase
{
    private readonly string _sharedDatabase = Path.Combine(Path.GetTempPath(), $"mortgage-analytics-shared-{Guid.NewGuid():N}.db");

    [TearDown]
    public void DeleteSharedDatabase()
    {
        SqliteConnection.ClearAllPools();
        File.Delete(_sharedDatabase);
    }

    private MortgageApiFactory Instance(string keyStore) => new(settings: new()
    {
        ["ConnectionStrings:Calculations"] = $"Data Source={_sharedDatabase}",
        ["DataProtection:Store"] = keyStore,
    });

    /// <summary>Signs a new user in on <paramref name="first"/>, then asks <paramref name="second"/> who that is.</summary>
    private static async Task<HttpStatusCode> SignInOnOneAskTheOtherAsync(MortgageApiFactory first, MortgageApiFactory second)
    {
        var email = UniqueEmail();
        using var client = first.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        await client.PostAsJsonAsync($"{AccountUrl}/register", new { email, password = GoodPassword });
        await ConfirmEmailAsync(client, email, first);
        var login = await client.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });
        var session = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("mortgage-analytics.session=", StringComparison.Ordinal)).Split(';')[0];

        using var other = second.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{AccountUrl}/manage/info");
        request.Headers.Add("Cookie", session);
        return (await other.SendAsync(request)).StatusCode;
    }

    [Test]
    public async Task KeysKeptInTheDatabase_KeepASessionSignedIn_OnEveryInstance()
    {
        using var first = Instance("Database");
        using var second = Instance("Database");

        Assert.That(await SignInOnOneAskTheOtherAsync(first, second), Is.EqualTo(HttpStatusCode.OK),
            "the second instance reads the keys the first signed the cookie with");
    }

    [Test]
    public async Task KeysKeptOnEachInstancesOwnDisk_SignTheSessionOut_OnAnother()
    {
        using var first = Instance("FileSystem");
        using var second = Instance("FileSystem");

        Assert.That(await SignInOnOneAskTheOtherAsync(first, second), Is.EqualTo(HttpStatusCode.Unauthorized),
            "each instance has keys of its own, so the other cannot read the cookie: why the database store exists");
    }
}
