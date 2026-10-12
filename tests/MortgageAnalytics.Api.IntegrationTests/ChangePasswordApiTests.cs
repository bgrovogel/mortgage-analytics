using System.Net;
using System.Net.Http.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Changing the password while signed in: it needs the current one, keeps this session, and ends every other.
/// Tests that let time pass have a host of their own, because the shared host's tests expect the clock to stand still.
/// </summary>
[TestFixture]
public class ChangePasswordApiTests : ApiTestBase
{
    private const string NewPassword = "brand-new-password-2";

    [Test]
    public async Task ChangingThePassword_KeepsThisSession_AndOnlyTheNewPasswordSignsIn()
    {
        using var host = new MortgageApiFactory();
        var email = UniqueEmail();
        using var client = await SignUpAsync(email, host);

        var change = await ChangePasswordAsync(client, GoodPassword, NewPassword);
        // A session is rechecked once any time has passed since it began, as it always has between two real requests.
        host.Clock.Advance(TimeSpan.FromSeconds(1));
        var afterwards = await client.GetAsync($"{AccountUrl}/manage/info");
        using var stranger = host.CreateClient();
        var withOld = await stranger.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });
        var withNew = await stranger.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = NewPassword });

        Assert.Multiple(() =>
        {
            Assert.That(change.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "the current password allows the change");
            Assert.That(afterwards.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the session that changed it stays signed in");
            Assert.That(withOld.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "the old password no longer signs in");
            Assert.That(withNew.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the new one does");
        });
    }

    [Test]
    public async Task AnotherSessionOfTheAccount_IsSignedOut()
    {
        using var host = new MortgageApiFactory();
        var email = UniqueEmail();
        using var phone = await SignUpAsync(email, host);
        using var laptop = host.CreateClient();
        await laptop.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });

        await ChangePasswordAsync(phone, GoodPassword, NewPassword);
        host.Clock.Advance(TimeSpan.FromSeconds(1));
        var info = await laptop.GetAsync($"{AccountUrl}/manage/info");

        Assert.That(info.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "a session started with the old password ends at once");
    }

    [Test]
    public async Task AWrongCurrentPassword_ChangesNothing()
    {
        var email = UniqueEmail();
        using var client = await SignUpAsync(email);

        var change = await ChangePasswordAsync(client, "not-the-password-1", NewPassword);
        var problem = await ReadJsonAsync(change);
        using var stranger = ApiFixture.Factory.CreateClient();
        var withOld = await stranger.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });

        Assert.Multiple(() =>
        {
            Assert.That(change.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "a wrong current password is refused");
            Assert.That(problem.GetProperty("errors").TryGetProperty("currentPassword", out _), Is.True, "with the error on that field");
            Assert.That(withOld.StatusCode, Is.EqualTo(HttpStatusCode.OK), "and the password is unchanged");
        });
    }

    [Test]
    public async Task WrongCurrentPasswords_CountTowardLockout()
    {
        var email = UniqueEmail();
        using var client = await SignUpAsync(email);

        for (var attempt = 1; attempt <= 5; attempt++)
            await ChangePasswordAsync(client, $"wrong-password-{attempt}", NewPassword);
        using var stranger = ApiFixture.Factory.CreateClient();
        var signIn = await stranger.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });

        Assert.That((await ReadJsonAsync(signIn)).GetProperty("detail").GetString(), Is.EqualTo("LockedOut"),
            "five wrong passwords lock the account, so a stolen session cannot guess the password here");
    }

    [Test]
    public async Task ANewPasswordThatBreaksTheRules_IsRefused()
    {
        using var client = await SignUpAsync();

        var change = await ChangePasswordAsync(client, GoodPassword, "short");
        var errors = (await ReadJsonAsync(change)).GetProperty("errors");

        Assert.Multiple(() =>
        {
            Assert.That(change.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "the password rules apply to a change too");
            Assert.That(errors.TryGetProperty("newPassword", out _), Is.True, "with the errors on the new password");
        });
    }

    [Test]
    public async Task SignedOut_CannotChangeAnything()
    {
        using var client = ApiFixture.Factory.CreateClient();

        var change = await ChangePasswordAsync(client, GoodPassword, NewPassword);

        Assert.That(change.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "only a signed-in user can change their password");
    }

    private static Task<HttpResponseMessage> ChangePasswordAsync(HttpClient client, string currentPassword, string newPassword) =>
        client.PostAsJsonAsync($"{AccountUrl}/password", new { currentPassword, newPassword });
}
