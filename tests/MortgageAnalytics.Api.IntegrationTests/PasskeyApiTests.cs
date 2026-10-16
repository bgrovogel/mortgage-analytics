using System.Buffers.Text;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Passkeys end to end through HTTP and a real database, with a software authenticator standing in for the device: a
/// user registers one, signs in with it, and the server refuses everything that is not exactly that.
/// </summary>
[TestFixture]
public class PasskeyApiTests : ApiTestBase
{
    private const string Url = "/api/v1/account/passkeys";

    private static async Task<(JsonElement State, JsonElement Options)> OptionsAsync(HttpClient client, string path)
    {
        var response = await client.PostAsync($"{Url}/{path}", null);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"setup: {path} should answer; body: {await response.Content.ReadAsStringAsync()}");
        var body = await ReadJsonAsync(response);
        return (body.GetProperty("state"), body.GetProperty("options"));
    }

    private static async Task<HttpResponseMessage> RegisterAsync(HttpClient me, SoftwareAuthenticator device, string name = "Laptop")
    {
        var (state, options) = await OptionsAsync(me, "registration-options");
        return await me.PostAsJsonAsync(Url, new { name, state, credential = device.Create(options) });
    }

    private static async Task<HttpResponseMessage> SignInAsync(HttpClient anonymous, SoftwareAuthenticator device)
    {
        var (state, options) = await OptionsAsync(anonymous, "sign-in-options");
        return await anonymous.PostAsJsonAsync($"{Url}/sign-in", new { state, credential = device.Get(options) });
    }

    private static async Task<string?> EmailOfSessionAsync(HttpClient client) =>
        (await ReadJsonAsync(await client.GetAsync($"{AccountUrl}/session"))).GetProperty("email").GetString();

    [Test]
    public async Task APasskey_IsRegistered_ThenSignsInWithoutAPassword()
    {
        var email = UniqueEmail();
        using var me = await SignUpAsync(email);
        var device = new SoftwareAuthenticator();

        var registered = await RegisterAsync(me, device, "  My laptop  ");
        var listed = await ReadJsonAsync(await me.GetAsync(Url));
        using var elsewhere = ApiFixture.Factory.CreateClient(); // another device: no cookie
        var signedIn = await SignInAsync(elsewhere, device);

        Assert.Multiple(async () =>
        {
            Assert.That(registered.StatusCode, Is.EqualTo(HttpStatusCode.Created), "the passkey is registered");
            Assert.That(listed.GetArrayLength(), Is.EqualTo(1), "and listed");
            Assert.That(listed[0].GetProperty("name").GetString(), Is.EqualTo("My laptop"), "under its trimmed name");
            Assert.That(listed[0].GetProperty("id").GetString(), Is.EqualTo(Base64Url.EncodeToString(device.CredentialId)), "by its credential id");
            Assert.That(signedIn.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "the device signs in");
            Assert.That(await EmailOfSessionAsync(elsewhere), Is.EqualTo(email), "as the user who registered it, with the session cookie");
        });
    }

    [Test]
    public async Task SigningIn_IsNoted_OnThePasskey()
    {
        using var me = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        await RegisterAsync(me, device);
        using var elsewhere = ApiFixture.Factory.CreateClient();
        device.Counter = 7;

        await SignInAsync(elsewhere, device);
        var listed = await ReadJsonAsync(await me.GetAsync(Url));

        Assert.That(listed[0].GetProperty("lastUsedAt").ValueKind, Is.EqualTo(JsonValueKind.String), "the passkey says when it last signed in");
    }

    [Test]
    public async Task ADeviceWhoseCounterGoesBackwards_IsRefused()
    {
        using var me = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        await RegisterAsync(me, device);
        using var elsewhere = ApiFixture.Factory.CreateClient();
        device.Counter = 9;
        await SignInAsync(elsewhere, device);

        device.Counter = 4; // a copy of the key, or a replay: real devices only count up
        using var another = ApiFixture.Factory.CreateClient();
        var response = await SignInAsync(another, device);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "a counter that went back is not the same device");
    }

    [Test]
    public async Task AnAnswer_CannotBeUsedTwice()
    {
        using var me = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        await RegisterAsync(me, device);
        using var elsewhere = ApiFixture.Factory.CreateClient();
        var (state, options) = await OptionsAsync(elsewhere, "sign-in-options");
        var answer = new { state, credential = device.Get(options) };

        var first = await elsewhere.PostAsJsonAsync($"{Url}/sign-in", answer);
        using var thief = ApiFixture.Factory.CreateClient();
        var replay = await thief.PostAsJsonAsync($"{Url}/sign-in", answer);

        Assert.Multiple(() =>
        {
            Assert.That(first.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "the first answer signs in");
            Assert.That(replay.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "the same answer sent again does not, even from the same device that has no counter to go up");
        });
    }

    [Test]
    public async Task APasskey_ForAnotherSite_IsRefused()
    {
        using var me = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        await RegisterAsync(me, device);
        device.Origin = "https://evil.example"; // the device signs for the site it is on, and the API checks that is this one
        using var elsewhere = ApiFixture.Factory.CreateClient();

        var response = await SignInAsync(elsewhere, device);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "an answer made for another origin is not an answer for this one");
    }

    [Test]
    public async Task ADeviceThatNamesAnotherUser_IsRefused()
    {
        using var me = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        await RegisterAsync(me, device);
        device.UserHandleToSend = [1, 2, 3];
        using var elsewhere = ApiFixture.Factory.CreateClient();

        var response = await SignInAsync(elsewhere, device);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "the user handle must be the one the passkey was made for");
    }

    [Test]
    public async Task APasskeyNobodyRegistered_IsRefused()
    {
        using var elsewhere = ApiFixture.Factory.CreateClient();
        var device = new SoftwareAuthenticator();
        device.Create(JsonDocument.Parse("{\"challenge\":\"AAAA\",\"user\":{\"id\":\"AAAA\"}}").RootElement); // makes a key the server never saw

        var response = await SignInAsync(elsewhere, device);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "an unknown credential cannot sign in");
    }

    [Test]
    public async Task TheStateOfAnotherCeremony_IsRefused()
    {
        using var me = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        var (registrationState, registrationOptions) = await OptionsAsync(me, "registration-options");
        device.Create(registrationOptions);
        using var elsewhere = ApiFixture.Factory.CreateClient();
        var (_, signInOptions) = await OptionsAsync(elsewhere, "sign-in-options");

        var response = await elsewhere.PostAsJsonAsync($"{Url}/sign-in", new { state = registrationState, credential = device.Get(signInOptions) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "a token made for registering cannot be used to sign in");
    }

    [Test]
    public async Task AForgedState_IsRefused()
    {
        using var elsewhere = ApiFixture.Factory.CreateClient();
        var device = new SoftwareAuthenticator();
        var (_, options) = await OptionsAsync(elsewhere, "sign-in-options");

        var response = await elsewhere.PostAsJsonAsync($"{Url}/sign-in", new { state = "not-a-token", credential = device.Get(options) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "only the API can make a state");
    }

    [Test]
    public async Task ARegistrationFromAnotherUsersState_IsRefused()
    {
        using var alice = await SignUpAsync();
        using var bob = await SignUpAsync();
        var (state, options) = await OptionsAsync(alice, "registration-options");
        var device = new SoftwareAuthenticator();

        var response = await bob.PostAsJsonAsync(Url, new { name = "Stolen", state, credential = device.Create(options) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "a registration belongs to the user who started it");
    }

    [Test]
    public async Task ThePasskeyOfAnotherUser_CannotBeRemoved_AndYourOwnCan()
    {
        using var alice = await SignUpAsync();
        using var bob = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        await RegisterAsync(alice, device);
        var id = Base64Url.EncodeToString(device.CredentialId);

        var byBob = await bob.DeleteAsync($"{Url}/{id}");
        var byAlice = await alice.DeleteAsync($"{Url}/{id}");
        using var elsewhere = ApiFixture.Factory.CreateClient();
        var after = await SignInAsync(elsewhere, device);

        Assert.Multiple(() =>
        {
            Assert.That(byBob.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), "it is not Bob's");
            Assert.That(byAlice.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "its owner removes it");
            Assert.That(after.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "and it can no longer sign in");
        });
    }

    [Test]
    public async Task ADevice_CannotRegisterTheSamePasskeyTwice()
    {
        using var me = await SignUpAsync();
        var device = new SoftwareAuthenticator();
        await RegisterAsync(me, device);

        var again = await RegisterAsync(me, device, "Again");

        Assert.That(again.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "its credential is already registered");
    }

    [Test]
    public async Task AUser_HasALimitOnPasskeys()
    {
        using var me = await SignUpAsync();
        var registered = new List<HttpStatusCode>();
        for (var i = 0; i < Endpoints.PasskeyEndpoints.MaxPasskeysPerUser; i++)
            registered.Add((await RegisterAsync(me, new SoftwareAuthenticator(), $"Device {i}")).StatusCode);

        var response = await me.PostAsync($"{Url}/registration-options", null);

        Assert.Multiple(() =>
        {
            Assert.That(registered, Is.All.EqualTo(HttpStatusCode.Created), "up to the limit, each is registered");
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "one more is refused, with a reason");
        });
    }

    [Test]
    public async Task ANameIsNeeded()
    {
        using var me = await SignUpAsync();
        var (state, options) = await OptionsAsync(me, "registration-options");

        var response = await me.PostAsJsonAsync(Url, new { name = "  ", state, credential = new SoftwareAuthenticator().Create(options) });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "a passkey is told apart by its name");
    }

    [Test]
    public async Task Registering_NeedsAnAccount_ButSigningInOptionsDoNot()
    {
        var list = await Client.GetAsync(Url);
        var options = await Client.PostAsync($"{Url}/registration-options", null);
        var register = await Client.PostAsJsonAsync(Url, new { name = "x", state = "x", credential = new { } });
        var remove = await Client.DeleteAsync($"{Url}/AAAA");
        var signInOptions = await Client.PostAsync($"{Url}/sign-in-options", null);

        Assert.Multiple(() =>
        {
            Assert.That(list.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "listing needs an account");
            Assert.That(options.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "so does starting a registration");
            Assert.That(register.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "and finishing one");
            Assert.That(remove.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "and removing one");
            Assert.That(signInOptions.StatusCode, Is.EqualTo(HttpStatusCode.OK), "but a visitor can start signing in");
        });
    }

    [Test]
    public async Task TheOptions_AreForThisSite_AndAskForADiscoverablePasskey()
    {
        using var me = await SignUpAsync();

        var (_, options) = await OptionsAsync(me, "registration-options");

        Assert.Multiple(() =>
        {
            Assert.That(options.GetProperty("rp").GetProperty("id").GetString(), Is.EqualTo("localhost"), "the passkey is for this domain");
            Assert.That(options.GetProperty("authenticatorSelection").GetProperty("residentKey").GetString(), Is.EqualTo("required"),
                "the device keeps it, so signing in needs no account name");
            Assert.That(options.GetProperty("challenge").GetString(), Has.Length.GreaterThanOrEqualTo(16), "with a challenge to sign");
        });
    }
}
