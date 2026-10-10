using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.WebUtilities;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Email confirmation and password reset, end to end: the API sends an email (captured by the test host),
/// and the link in it does what it says.
/// </summary>
[TestFixture]
public class AccountEmailTests : ApiTestBase
{
    private static Task<HttpResponseMessage> RegisterAsync(string email) =>
        Client.PostAsJsonAsync($"{AccountUrl}/register", new { email, password = GoodPassword });

    private static Task<HttpResponseMessage> SignInAsync(HttpClient client, string email, string password = GoodPassword) =>
        client.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password });

    private static Dictionary<string, string> QueryOf(string url) =>
        QueryHelpers.ParseQuery(new Uri(url).Query).ToDictionary(p => p.Key, p => p.Value.ToString());

    [Test]
    public async Task Registering_SendsAConfirmationEmail_WithALinkToTheAppsConfirmPage()
    {
        var email = UniqueEmail();

        await RegisterAsync(email);

        var message = LastEmailTo(email);
        Assert.Multiple(() =>
        {
            Assert.That(message, Is.Not.Null, "a confirmation email is sent");
            Assert.That(message!.Subject, Is.EqualTo("Confirm your email for Mortgage Analytics"), "it says what it is");
            Assert.That(message.ActionUrl, Does.StartWith("http://localhost/confirm-email?userId="), "the link opens the app's page, not a bare API response");
            Assert.That(QueryOf(message.ActionUrl).ContainsKey("code"), Is.True, "and carries the confirmation code");
            Assert.That(message.Text, Does.Contain(message.ActionUrl), "the link is in the text too, for mail apps that show no buttons");
        });
    }

    [Test]
    public async Task SigningIn_BeforeConfirmingTheEmail_IsRefused()
    {
        var email = UniqueEmail();
        await RegisterAsync(email);

        var login = await SignInAsync(Client, email);
        var problem = await ReadJsonAsync(login);

        Assert.Multiple(() =>
        {
            Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "an unconfirmed email cannot sign in");
            Assert.That(problem.GetProperty("detail").GetString(), Is.EqualTo("NotAllowed"), "the client can tell this apart from a wrong password");
        });
    }

    [Test]
    public async Task FollowingTheConfirmationLink_LetsTheUserSignIn()
    {
        var email = UniqueEmail();
        await RegisterAsync(email);
        using var client = ApiFixture.Factory.CreateClient();

        var confirm = await ConfirmEmailAsync(client, email);
        var login = await SignInAsync(client, email);

        Assert.Multiple(() =>
        {
            Assert.That(confirm.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the code in the email confirms the address");
            Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.OK), "and then signing in works");
        });
    }

    [Test]
    public async Task ATamperedConfirmationCode_IsRejected()
    {
        var email = UniqueEmail();
        await RegisterAsync(email);
        var query = QueryOf(LastEmailTo(email)!.ActionUrl);

        var confirm = await Client.GetAsync($"{AccountUrl}/confirmEmail?userId={query["userId"]}&code=not-the-code");

        Assert.That(confirm.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "only the code that was sent works");
    }

    [Test]
    public async Task AskingAgain_SendsAnotherConfirmationEmail()
    {
        var email = UniqueEmail();
        await RegisterAsync(email);
        var before = ApiFixture.Factory.SentMail.Count(m => m.To == email);

        var resend = await Client.PostAsJsonAsync($"{AccountUrl}/resendConfirmationEmail", new { email });

        Assert.Multiple(() =>
        {
            Assert.That(resend.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the request succeeds");
            Assert.That(ApiFixture.Factory.SentMail.Count(m => m.To == email), Is.EqualTo(before + 1), "and a fresh email goes out");
        });
    }

    [Test]
    public async Task AForgottenPassword_IsResetWithTheLinkInTheEmail()
    {
        var email = UniqueEmail();
        using var _ = await SignUpAsync(email);
        const string newPassword = "brand-new-password-2";

        var forgot = await Client.PostAsJsonAsync($"{AccountUrl}/forgotPassword", new { email });
        var message = LastEmailTo(email)!;
        var query = QueryOf(message.ActionUrl);
        var reset = await Client.PostAsJsonAsync($"{AccountUrl}/resetPassword", new { email = query["email"], resetCode = query["code"], newPassword });
        using var client = ApiFixture.Factory.CreateClient();
        var oldPassword = await SignInAsync(client, email);
        var withNewPassword = await SignInAsync(client, email, newPassword);

        Assert.Multiple(() =>
        {
            Assert.That(forgot.StatusCode, Is.EqualTo(HttpStatusCode.OK), "asking for a reset succeeds");
            Assert.That(message.Subject, Is.EqualTo("Reset your Mortgage Analytics password"), "the email says what it is");
            Assert.That(message.ActionUrl, Does.StartWith("http://localhost/reset-password?"), "its link opens the app's reset page");
            Assert.That(reset.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the code in the link resets the password");
            Assert.That(oldPassword.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "the old password no longer works");
            Assert.That(withNewPassword.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the new one does");
        });
    }

    [Test]
    public async Task AskingToResetAnUnknownEmail_LooksTheSame_ButSendsNothing()
    {
        var email = UniqueEmail();

        var forgot = await Client.PostAsJsonAsync($"{AccountUrl}/forgotPassword", new { email });

        Assert.Multiple(() =>
        {
            Assert.That(forgot.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the answer does not reveal whether an account exists");
            Assert.That(LastEmailTo(email), Is.Null, "and no email is sent");
        });
    }

    [Test]
    public async Task AWrongResetCode_IsRejected()
    {
        var email = UniqueEmail();
        using var _ = await SignUpAsync(email);

        var reset = await Client.PostAsJsonAsync($"{AccountUrl}/resetPassword", new { email, resetCode = "bm90LWEtY29kZQ", newPassword = "brand-new-password-2" });

        await AssertProblemAsync(reset, HttpStatusCode.BadRequest, "a made-up code cannot reset a password");
    }
}
