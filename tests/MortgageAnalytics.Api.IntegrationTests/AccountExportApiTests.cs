using System.Buffers.Text;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>"Download your data": everything the account holds, in one file, and nothing of anyone else's.</summary>
[TestFixture]
public class AccountExportApiTests : ApiTestBase
{
    private const string Url = "/api/v1/account/export";

    [Test]
    public async Task TheExport_HoldsTheEmail_TheSaves_ThePasskeys_AndTheArrangement()
    {
        var email = UniqueEmail();
        using var me = await SignUpAsync(email);
        await me.PostAsJsonAsync(CalculationsUrl, new { name = "Oak St", inputs = A.Request.WithHomePrice(512_000m).Build() });
        var device = new SoftwareAuthenticator();
        var options = await ReadJsonAsync(await me.PostAsync("/api/v1/account/passkeys/registration-options", null));
        await me.PostAsJsonAsync("/api/v1/account/passkeys", new { name = "My laptop", state = options.GetProperty("state").GetString(), credential = device.Create(options.GetProperty("options")) });
        await me.PutAsJsonAsync("/api/v1/account/key-figures", new { order = new[] { "pmi", "cash" }, hidden = new[] { "cash" } });

        var response = await me.GetAsync(Url);
        var body = await ReadJsonAsync(response);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the account can download its data");
            Assert.That(response.Content.Headers.ContentDisposition?.DispositionType, Is.EqualTo("attachment"), "as a file, not a page");
            Assert.That(response.Content.Headers.ContentDisposition?.FileName, Does.StartWith("mortgage-analytics-data").And.EndWith(".json"), "named for what it is");
            Assert.That(body.GetProperty("email").GetString(), Is.EqualTo(email), "whose it is");
            Assert.That(body.GetProperty("exportedAt").GetDateTimeOffset(), Is.EqualTo(TestClock.Now), "and when it was made, by the server clock");
            Assert.That(body.GetProperty("savedCalculations").GetArrayLength(), Is.EqualTo(1), "every saved calculation");
            Assert.That(body.GetProperty("savedCalculations")[0].GetProperty("inputs").GetProperty("homePrice").GetDecimal(), Is.EqualTo(512_000m), "with all its inputs, so it can be put back");
            Assert.That(body.GetProperty("passkeys")[0].GetProperty("name").GetString(), Is.EqualTo("My laptop"), "each passkey by name");
            Assert.That(body.GetProperty("keyFigures").GetProperty("order")[0].GetString(), Is.EqualTo("pmi"), "and the arrangement of key figures");
            Assert.That(body.GetProperty("sessions").GetArrayLength(), Is.GreaterThanOrEqualTo(1), "and where the account is signed in");
            Assert.That(body.GetProperty("sessions")[0].TryGetProperty("device", out _), Is.True, "each by its device, which is all the account keeps of it");
        });
    }

    [Test]
    public async Task TheExport_NeverHoldsAPasskeysKey_OrAPasswordHash()
    {
        using var me = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        var options = await ReadJsonAsync(await me.PostAsync("/api/v1/account/passkeys/registration-options", null));
        await me.PostAsJsonAsync("/api/v1/account/passkeys", new { name = "Phone", state = options.GetProperty("state").GetString(), credential = device.Create(options.GetProperty("options")) });

        var text = await (await me.GetAsync(Url)).Content.ReadAsStringAsync();

        Assert.Multiple(() =>
        {
            Assert.That(text, Does.Not.Contain("publicKey").IgnoreCase, "a public key is for the server to check a signature with, not for a file");
            Assert.That(text, Does.Not.Contain("passwordHash").IgnoreCase, "and no hash of the password");
            Assert.That(text, Does.Not.Contain("securityStamp").IgnoreCase, "nor anything that keeps a session");
        });
    }

    [Test]
    public async Task TheExport_HoldsOnlyTheirOwnData()
    {
        using var alice = await SignUpAsync();
        using var bob = await SignUpAsync();
        await alice.PostAsJsonAsync(CalculationsUrl, new { name = "Alice's secret home", inputs = A.Request.Build() });

        var body = await ReadJsonAsync(await bob.GetAsync(Url));

        Assert.That(body.GetProperty("savedCalculations").GetArrayLength(), Is.EqualTo(0), "another account's saves are not in it");
    }

    [Test]
    public async Task ANewAccount_ExportsItsEmailAndNothingElse()
    {
        using var me = await SignUpAsync();

        var body = await ReadJsonAsync(await me.GetAsync(Url));

        Assert.Multiple(() =>
        {
            Assert.That(body.GetProperty("savedCalculations").GetArrayLength(), Is.EqualTo(0), "no saves");
            Assert.That(body.GetProperty("passkeys").GetArrayLength(), Is.EqualTo(0), "no passkeys");
            Assert.That(body.GetProperty("keyFigures").GetProperty("order").GetArrayLength(), Is.EqualTo(0), "and no arrangement");
        });
    }

    [Test]
    public async Task WithoutAnAccount_ThereIsNothingToDownload() =>
        Assert.That((await Client.GetAsync(Url)).StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "it needs an account");
}
