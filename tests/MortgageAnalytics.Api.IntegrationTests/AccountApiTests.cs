using System.Net;
using System.Net.Http.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>Accounts through HTTP: register, sign in with a cookie, who am I, sign out, and the rules.</summary>
[TestFixture]
public class AccountApiTests : ApiTestBase
{
    [Test]
    public async Task SigningUp_StartsASession_ThatSigningOutEnds()
    {
        var email = UniqueEmail();
        using var client = await SignUpAsync(email);

        var me = await ReadJsonAsync(await client.GetAsync($"{AccountUrl}/manage/info"));
        var signOut = await client.PostAsync($"{AccountUrl}/logout", null);
        var afterwards = await client.GetAsync($"{AccountUrl}/manage/info");

        Assert.Multiple(() =>
        {
            Assert.That(me.GetProperty("email").GetString(), Is.EqualTo(email), "the session knows who is signed in");
            Assert.That(signOut.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "signing out succeeds");
            Assert.That(afterwards.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "and ends the session");
        });
    }

    [Test]
    public async Task TheSessionCookie_CannotBeReadByScripts_OrSentByOtherSites()
    {
        var email = UniqueEmail();
        using var client = ApiFixture.Factory.CreateClient();
        await client.PostAsJsonAsync($"{AccountUrl}/register", new { email, password = GoodPassword });
        await ConfirmEmailAsync(client, email);

        var login = await client.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });
        var cookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("mortgage-analytics.session=", StringComparison.Ordinal));

        Assert.Multiple(() =>
        {
            Assert.That(cookie, Does.Contain("httponly").IgnoreCase, "HttpOnly: invisible to JavaScript");
            Assert.That(cookie, Does.Contain("samesite=strict").IgnoreCase, "SameSite=Strict: never sent by another site");
        });
    }

    [Test]
    public async Task AWrongPassword_IsRefused()
    {
        var email = UniqueEmail();
        using var _ = await SignUpAsync(email);

        var login = await Client.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = "not-the-password-1" });

        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "a wrong password does not sign in");
    }

    [TestCase("short1", "PasswordTooShort", TestName = "a password under 8 characters")]
    [TestCase("no-digits-here", "PasswordRequiresDigit", TestName = "a password without a digit")]
    public async Task AWeakPassword_IsRejected_WithTheRuleItBreaks(string password, string rule)
    {
        var response = await Client.PostAsJsonAsync($"{AccountUrl}/register", new { email = UniqueEmail(), password });

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "a weak password is a validation problem");
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");
        Assert.That(errors.TryGetProperty(rule, out _), Is.True, $"the broken rule is named; errors: {errors}");
    }

    [Test]
    public async Task AnEmailThatIsAlreadyRegistered_IsRejected()
    {
        var email = UniqueEmail();
        using var _ = await SignUpAsync(email);

        var again = await Client.PostAsJsonAsync($"{AccountUrl}/register", new { email, password = GoodPassword });

        await AssertProblemAsync(again, HttpStatusCode.BadRequest, "one account per email");
    }
}
