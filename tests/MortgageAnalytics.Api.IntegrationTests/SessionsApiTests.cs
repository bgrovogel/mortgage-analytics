using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Where an account is signed in: each sign-in is a session that can be listed and ended from another, through real
/// cookies on separate clients. Ending a session takes effect on that device's very next request.
/// </summary>
[TestFixture]
public class SessionsApiTests : ApiTestBase
{
    private const string SessionsUrl = $"{AccountUrl}/sessions";
    private const string ChromeOnWindows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
    private const string SafariOnIPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

    /// <summary>The same account signed in again, on another device, as a second client with a cookie of its own.</summary>
    private static async Task<HttpClient> SignInAgainAsync(string email, string userAgent, MortgageApiFactory? host = null)
    {
        var client = (host ?? ApiFixture.Factory).CreateClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd(userAgent);
        var login = await client.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });
        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.OK), "setup: the second sign-in works");
        return client;
    }

    /// <summary>Signs up with a laptop's browser, then signs in again from a phone; returns both, and the account's email.</summary>
    private static async Task<(HttpClient Laptop, HttpClient Phone, string Email)> TwoDevicesAsync(MortgageApiFactory? host = null)
    {
        host ??= ApiFixture.Factory;
        var email = UniqueEmail();
        var laptop = host.CreateClient();
        laptop.DefaultRequestHeaders.UserAgent.ParseAdd(ChromeOnWindows);
        await laptop.PostAsJsonAsync($"{AccountUrl}/register", new { email, password = GoodPassword });
        await ConfirmEmailAsync(laptop, email, host);
        await laptop.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });
        var phone = await SignInAgainAsync(email, SafariOnIPhone, host);
        return (laptop, phone, email);
    }

    private static async Task<JsonElement[]> ListAsync(HttpClient client) =>
        [.. (await ReadJsonAsync(await client.GetAsync(SessionsUrl))).EnumerateArray()];

    private static async Task<HttpStatusCode> StillSignedInAsync(HttpClient client) =>
        (await client.GetAsync(CalculationsUrl)).StatusCode;

    [Test]
    public async Task TheListHasEachSignIn_NamedByItsDevice_WithThisOneMarked()
    {
        var (laptop, phone, _) = await TwoDevicesAsync();

        var fromLaptop = await ListAsync(laptop);

        Assert.Multiple(() =>
        {
            Assert.That(fromLaptop.Select(s => s.GetProperty("device").GetString()), Is.EquivalentTo(new[] { "Chrome on Windows", "Safari on iPhone" }), "both sign-ins, named by browser and system");
            Assert.That(fromLaptop.Where(s => s.GetProperty("current").GetBoolean()).Select(s => s.GetProperty("device").GetString()), Is.EqualTo(new[] { "Chrome on Windows" }), "the laptop sees itself marked");
            Assert.That(fromLaptop.All(s => s.TryGetProperty("createdAt", out _) && s.TryGetProperty("lastSeenAt", out _)), Is.True, "each says when it began and was last used");
        });
        using (phone) { }
        laptop.Dispose();
    }

    [Test]
    public async Task ASession_StaysItself_AcrossRequests_ListedOnceAndStillMarkedAsThisOne()
    {
        using var host = new MortgageApiFactory();
        var (laptop, phone, _) = await TwoDevicesAsync(host);

        // Once time has passed, every request checks the cookie against the user and issues it again with a fresh principal,
        // which carries none of the cookie's own claims: the session must survive being re-issued. (The test clock is frozen,
        // so without this nothing is ever checked again.)
        for (var request = 0; request < 3; request++)
        {
            host.Clock.Advance(TimeSpan.FromSeconds(2));
            await StillSignedInAsync(laptop);
        }
        var listed = await ListAsync(laptop);

        Assert.Multiple(() =>
        {
            Assert.That(listed, Has.Length.EqualTo(2), "still the laptop and the phone, not a new session for each request");
            Assert.That(listed.Count(s => s.GetProperty("current").GetBoolean()), Is.EqualTo(1), "and the laptop still knows which one it is");
        });
        phone.Dispose();
    }

    [Test]
    public async Task EndingAnotherSession_SignsThatDeviceOut_OnItsNextRequest_AndLeavesThisOneIn()
    {
        var (laptop, phone, _) = await TwoDevicesAsync();
        var other = (await ListAsync(laptop)).Single(s => !s.GetProperty("current").GetBoolean());

        var ended = await laptop.DeleteAsync($"{SessionsUrl}/{other.GetProperty("id").GetGuid()}");

        Assert.Multiple(async () =>
        {
            Assert.That(ended.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "it is ended");
            Assert.That(await StillSignedInAsync(phone), Is.EqualTo(HttpStatusCode.Unauthorized), "the phone is signed out at once");
            Assert.That(await StillSignedInAsync(laptop), Is.EqualTo(HttpStatusCode.OK), "the laptop is still in");
            Assert.That(await ListAsync(laptop), Has.Length.EqualTo(1), "and the list is one");
        });
    }

    [Test]
    public async Task ThisSession_IsEndedBySigningOut_NotFromTheList()
    {
        var (laptop, phone, _) = await TwoDevicesAsync();
        var mine = (await ListAsync(laptop)).Single(s => s.GetProperty("current").GetBoolean());

        var response = await laptop.DeleteAsync($"{SessionsUrl}/{mine.GetProperty("id").GetGuid()}");

        Assert.Multiple(async () =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "ending the one you are using is signing out, which has its own button");
            Assert.That(await StillSignedInAsync(laptop), Is.EqualTo(HttpStatusCode.OK), "so it is still in");
        });
        phone.Dispose();
    }

    [Test]
    public async Task SigningOutEverywhereElse_EndsEveryOtherSession_AndKeepsThisOne()
    {
        var (laptop, phone, email) = await TwoDevicesAsync();
        var tablet = await SignInAgainAsync(email, SafariOnIPhone);

        var response = await laptop.PostAsync($"{SessionsUrl}/end-others", null);

        Assert.Multiple(async () =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "done");
            Assert.That((await ReadJsonAsync(response)).GetProperty("ended").GetInt32(), Is.EqualTo(2), "the phone and the tablet");
            Assert.That(await StillSignedInAsync(phone), Is.EqualTo(HttpStatusCode.Unauthorized), "the phone is out");
            Assert.That(await StillSignedInAsync(tablet), Is.EqualTo(HttpStatusCode.Unauthorized), "so is the tablet");
            Assert.That(await StillSignedInAsync(laptop), Is.EqualTo(HttpStatusCode.OK), "this one is not");
        });
    }

    [Test]
    public async Task SigningOut_RemovesThatSessionFromTheList()
    {
        var (laptop, phone, _) = await TwoDevicesAsync();

        await laptop.PostAsync($"{AccountUrl}/logout", null);

        var fromPhone = await ListAsync(phone);
        Assert.That(fromPhone.Select(s => s.GetProperty("device").GetString()), Is.EqualTo(new[] { "Safari on iPhone" }), "the laptop is no longer somewhere you are signed in");
        laptop.Dispose();
    }

    [Test]
    public async Task OnePersonCannotSeeOrEnd_AnotherPersonsSessions()
    {
        var (laptop, phone, _) = await TwoDevicesAsync();
        var stranger = await SignUpAsync();
        var theirs = (await ListAsync(laptop)).First().GetProperty("id").GetGuid();

        var ended = await stranger.DeleteAsync($"{SessionsUrl}/{theirs}");

        Assert.Multiple(async () =>
        {
            Assert.That(ended.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), "not theirs: not found, which does not say it exists");
            Assert.That(await ListAsync(stranger), Has.Length.EqualTo(1), "a stranger lists only their own sign-in");
            Assert.That(await StillSignedInAsync(laptop), Is.EqualTo(HttpStatusCode.OK), "and nothing of ours was ended");
        });
        phone.Dispose();
    }

    [Test]
    public async Task AnUnknownSession_IsNotFound()
    {
        var client = await SignUpAsync();

        var response = await client.DeleteAsync($"{SessionsUrl}/{Guid.NewGuid()}");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), "there is no such session");
    }

    [Test]
    public async Task WithoutSigningIn_TheSessionsAreRefused()
    {
        Assert.Multiple(async () =>
        {
            Assert.That((await Client.GetAsync(SessionsUrl)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "listing needs an account");
            Assert.That((await Client.DeleteAsync($"{SessionsUrl}/{Guid.NewGuid()}")).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "so does ending one");
            Assert.That((await Client.PostAsync($"{SessionsUrl}/end-others", null)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "and ending the others");
        });
    }

    [Test]
    public async Task APasswordChange_KeepsThisSession_AndTheOtherIsSignedOut()
    {
        using var host = new MortgageApiFactory();
        var (laptop, phone, _) = await TwoDevicesAsync(host);

        var changed = await laptop.PostAsJsonAsync($"{AccountUrl}/password", new { currentPassword = GoodPassword, newPassword = "another-horse-2" });
        // Sessions are rechecked once any time has passed, as between two real requests.
        host.Clock.Advance(TimeSpan.FromSeconds(2));

        Assert.Multiple(async () =>
        {
            Assert.That(changed.IsSuccessStatusCode, Is.True, "setup: the password changes");
            Assert.That(await StillSignedInAsync(phone), Is.EqualTo(HttpStatusCode.Unauthorized), "the phone is out");
            Assert.That(await StillSignedInAsync(laptop), Is.EqualTo(HttpStatusCode.OK), "the laptop is still in, with its session still listed");
            Assert.That((await ListAsync(laptop)).Select(s => s.GetProperty("device").GetString()), Is.EqualTo(new[] { "Chrome on Windows" }), "and the phone's is cleared from the list");
        });
    }
}
