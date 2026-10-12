using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;
using MortgageAnalytics.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>Deleting your own account: it needs the password, and takes the saves and every session with it.</summary>
[TestFixture]
public class DeleteAccountApiTests : ApiTestBase
{
    [Test]
    public async Task DeletingTheAccount_WithItsPassword_RemovesIt_AndSignsOut()
    {
        var email = UniqueEmail();
        using var client = await SignUpAsync(email);

        var delete = await DeleteAccountAsync(client, GoodPassword);
        var afterwards = await client.GetAsync($"{AccountUrl}/manage/info");
        using var stranger = ApiFixture.Factory.CreateClient();
        var signIn = await stranger.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });
        var registerAgain = await stranger.PostAsJsonAsync($"{AccountUrl}/register", new { email, password = GoodPassword });

        Assert.Multiple(() =>
        {
            Assert.That(delete.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "deleting your own account with its password succeeds");
            Assert.That(afterwards.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "and ends the session");
            Assert.That(signIn.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "the account can no longer sign in");
            Assert.That(registerAgain.StatusCode, Is.EqualTo(HttpStatusCode.OK), "and its email address is free again, so nothing of it is left");
        });
    }

    [Test]
    public async Task DeletingTheAccount_DeletesItsSavedCalculations()
    {
        using var client = await SignUpAsync();
        var saved = await ReadJsonAsync(await client.PostAsJsonAsync(CalculationsUrl, new { name = "Oak St", inputs = A.Request.Build() }));
        var id = saved.GetProperty("id").GetGuid();

        await DeleteAccountAsync(client, GoodPassword);

        Assert.That(await SavedCalculationExistsAsync(id), Is.False, "the account's saves are deleted with it");
    }

    [Test]
    public async Task AWrongPassword_DeletesNothing()
    {
        using var client = await SignUpAsync();

        var delete = await DeleteAccountAsync(client, "not-the-password-1");
        var problem = await ReadJsonAsync(delete);
        var afterwards = await client.GetAsync($"{AccountUrl}/manage/info");

        Assert.Multiple(() =>
        {
            Assert.That(delete.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "a wrong password is refused");
            Assert.That(problem.GetProperty("errors").TryGetProperty("password", out _), Is.True, "with the error on the password field");
            Assert.That(afterwards.StatusCode, Is.EqualTo(HttpStatusCode.OK), "and the account, and its session, are still there");
        });
    }

    [Test]
    public async Task WrongPasswordsHere_CountTowardLockout()
    {
        var email = UniqueEmail();
        using var client = await SignUpAsync(email);

        for (var attempt = 1; attempt <= 5; attempt++)
            await DeleteAccountAsync(client, $"wrong-password-{attempt}");
        using var stranger = ApiFixture.Factory.CreateClient();
        var signIn = await stranger.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });

        Assert.That((await ReadJsonAsync(signIn)).GetProperty("detail").GetString(), Is.EqualTo("LockedOut"),
            "five wrong passwords lock the account, so a stolen session cannot guess the password here");
    }

    [Test]
    public async Task SignedOut_CannotDeleteAnything()
    {
        using var client = ApiFixture.Factory.CreateClient();

        var delete = await DeleteAccountAsync(client, GoodPassword);

        Assert.That(delete.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "only a signed-in user can delete their account");
    }

    [Test]
    public async Task AnotherSessionOfTheDeletedAccount_IsSignedOutToo()
    {
        // A host of its own, because this test moves the clock and the shared host's tests expect it to stand still.
        using var host = new MortgageApiFactory();
        var email = UniqueEmail();
        using var phone = await SignUpAsync(email, host);
        using var laptop = host.CreateClient();
        await laptop.PostAsJsonAsync($"{AccountUrl}/login?useCookies=true", new { email, password = GoodPassword });

        await DeleteAccountAsync(phone, GoodPassword);
        // A session is rechecked once any time has passed since it began, as it always has between two real requests.
        host.Clock.Advance(TimeSpan.FromSeconds(1));
        var info = await laptop.GetAsync($"{AccountUrl}/manage/info");
        var save = await laptop.PostAsJsonAsync(CalculationsUrl, new { name = "After deletion", inputs = A.Request.Build() });

        Assert.Multiple(() =>
        {
            Assert.That(info.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "the other device's session ends at once, not half an hour later");
            Assert.That(save.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "so it cannot save for an account that no longer exists");
        });
    }

    private static Task<HttpResponseMessage> DeleteAccountAsync(HttpClient client, string password) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, AccountUrl) { Content = JsonContent.Create(new { password }) });

    private static async Task<bool> SavedCalculationExistsAsync(Guid id)
    {
        await using var scope = ApiFixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CalculationsDbContext>();
        return await db.SavedCalculations.AnyAsync(c => c.Id == id);
    }
}
