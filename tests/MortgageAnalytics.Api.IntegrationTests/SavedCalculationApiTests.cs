using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// The saved-calculations endpoints, end to end through HTTP, EF Core and a real SQLite database, as a
/// signed-in user. The host is shared, so every test saves under a name of its own and searches for exactly that.
/// </summary>
[TestFixture]
public class SavedCalculationApiTests : ApiTestBase
{
    /// <summary>The signed-in user every test in this fixture acts as.</summary>
    private static HttpClient Me = null!;

    [OneTimeSetUp]
    public async Task SignIn() => Me = await SignUpAsync();

    [OneTimeTearDown]
    public void SignOut() => Me.Dispose();

    private static string UniqueName(string label) => $"{label} {Guid.NewGuid():N}";

    private static object SaveBody(string name, decimal homePrice = 400_000m) =>
        new { name, inputs = A.Request.WithHomePrice(homePrice).WithMonthlyExtra(200).Build() };

    private static async Task<JsonElement> SaveAsync(string name, decimal homePrice = 400_000m)
    {
        var response = await Me.PostAsJsonAsync(CalculationsUrl, SaveBody(name, homePrice));
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created), $"setup: saving \"{name}\" should succeed; body: {await response.Content.ReadAsStringAsync()}");
        return await ReadJsonAsync(response);
    }

    [Test]
    public async Task Save_Returns201_WithTheLocationAndTheSavedCalculation()
    {
        var name = UniqueName("Oak St");

        var response = await Me.PostAsJsonAsync(CalculationsUrl, SaveBody($"  {name}  "));
        var body = await ReadJsonAsync(response);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created), "a new resource was created");
            Assert.That(response.Headers.Location?.ToString(), Is.EqualTo($"{CalculationsUrl}/{body.GetProperty("id").GetGuid()}"), "Location points at it");
            Assert.That(body.GetProperty("name").GetString(), Is.EqualTo(name), "the name is trimmed");
            Assert.That(body.GetProperty("createdAt").GetDateTimeOffset(), Is.EqualTo(TestClock.Now), "timestamps come from the server clock");
        });
    }

    [Test]
    public async Task ASavedCalculation_ComesBackUnchanged_AndCalculatesAgain()
    {
        var saved = await SaveAsync(UniqueName("Round trip"), homePrice: 512_000m);

        var fetched = await ReadJsonAsync(await Me.GetAsync($"{CalculationsUrl}/{saved.GetProperty("id").GetGuid()}"));
        var calculation = await PostCalculateAsync(fetched.GetProperty("inputs"));

        Assert.Multiple(() =>
        {
            Assert.That(fetched.GetProperty("inputs").GetRawText(), Is.EqualTo(saved.GetProperty("inputs").GetRawText()), "the inputs are stored exactly");
            Assert.That(fetched.GetProperty("inputs").GetProperty("homePrice").GetDecimal(), Is.EqualTo(512_000m), "including the home price");
            Assert.That(calculation.StatusCode, Is.EqualTo(HttpStatusCode.OK), "saved inputs can be posted straight back to the calculator");
        });
    }

    [Test]
    public async Task ARefinanceComparison_IsSavedAndComesBackReadyToAnalyze()
    {
        var refinance = new
        {
            currentBalance = 300_000, currentAnnualInterestRate = 7, remainingTermInMonths = 300,
            newAnnualInterestRate = 6, newTermInMonths = 360, closingCosts = 6_000, financeClosingCosts = false,
        };
        var saved = await ReadJsonAsync(await Me.PostAsJsonAsync(CalculationsUrl, new { name = UniqueName("Refi"), refinance }));

        var fetched = await ReadJsonAsync(await Me.GetAsync($"{CalculationsUrl}/{saved.GetProperty("id").GetGuid()}"));
        var analysis = await Me.PostAsync("/api/v1/refinance/analyze",
            new StringContent(fetched.GetProperty("refinance").GetRawText(), System.Text.Encoding.UTF8, "application/json"));

        Assert.Multiple(() =>
        {
            Assert.That(fetched.GetProperty("kind").GetString(), Is.EqualTo("Refinance"), "the kind is a readable string");
            Assert.That(fetched.GetProperty("inputs").ValueKind, Is.EqualTo(JsonValueKind.Null), "there are no calculator inputs");
            Assert.That(analysis.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the saved comparison can be posted straight back");
        });
    }

    [Test]
    public async Task List_FindsCalculationsByName_IgnoringCase()
    {
        var tag = Guid.NewGuid().ToString("N");
        await SaveAsync($"Maple {tag} first");
        await SaveAsync($"MAPLE {tag} second");
        await SaveAsync(UniqueName("Unrelated"));

        var list = await ReadJsonAsync(await Me.GetAsync($"{CalculationsUrl}?search=maple%20{tag}"));

        Assert.That(
            list.EnumerateArray().Select(c => c.GetProperty("name").GetString()),
            Is.EqualTo(new[] { $"MAPLE {tag} second", $"Maple {tag} first" }),
            "both matches, newest first, and nothing else");
    }

    [Test]
    public async Task Put_RenamesACalculation_AndKeepsItsCreationTime()
    {
        var saved = await SaveAsync(UniqueName("Before"));
        var id = saved.GetProperty("id").GetGuid();
        var newName = UniqueName("After");

        var response = await Me.PutAsJsonAsync($"{CalculationsUrl}/{id}", SaveBody(newName));
        var body = await ReadJsonAsync(response);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the calculation exists");
            Assert.That(body.GetProperty("name").GetString(), Is.EqualTo(newName), "it has the new name");
            Assert.That(body.GetProperty("createdAt").GetDateTimeOffset(), Is.EqualTo(saved.GetProperty("createdAt").GetDateTimeOffset()), "renaming does not change when it was created");
        });
    }

    [Test]
    public async Task Delete_Returns204_AndTheCalculationIsGone()
    {
        var url = $"{CalculationsUrl}/{(await SaveAsync(UniqueName("Doomed"))).GetProperty("id").GetGuid()}";

        var deleted = await Me.DeleteAsync(url);

        Assert.That(deleted.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), "deleted");
        await AssertProblemAsync(await Me.GetAsync(url), HttpStatusCode.NotFound, "it cannot be read after deletion");
    }

    [TestCase("GET")]
    [TestCase("PUT")]
    [TestCase("DELETE")]
    public async Task AnUnknownId_IsA404Problem(string method)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), $"{CalculationsUrl}/{Guid.NewGuid()}");
        if (method == "PUT")
            request.Content = JsonContent.Create(SaveBody("Nobody"));

        await AssertProblemAsync(await Me.SendAsync(request), HttpStatusCode.NotFound, $"{method} of a missing calculation");
    }

    [Test]
    public async Task Save_Rejects_ABlankName_AndInvalidInputs_WithFieldErrors()
    {
        var body = new { name = " ", inputs = A.Request.WithHomePrice(0).Build() };

        var response = await Me.PostAsJsonAsync(CalculationsUrl, body);
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid input is a validation problem");
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");

        Assert.Multiple(() =>
        {
            Assert.That(errors.TryGetProperty("name", out _), Is.True, $"the blank name is reported; errors: {errors}");
            Assert.That(errors.TryGetProperty("inputs.homePrice", out _), Is.True, $"the inputs are checked like the calculator's, keyed by JSON path; errors: {errors}");
        });
    }

    [Test]
    public async Task WithoutSigningIn_SavedCalculationsAreOffLimits()
    {
        var list = await Client.GetAsync(CalculationsUrl);
        var save = await Client.PostAsJsonAsync(CalculationsUrl, SaveBody("Anonymous"));

        Assert.Multiple(() =>
        {
            Assert.That(list.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "listing needs an account");
            Assert.That(save.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), "and so does saving");
        });
    }

    [Test]
    public async Task AnotherUser_CannotSeeOrChangeMyCalculations()
    {
        var name = UniqueName("Private");
        var url = $"{CalculationsUrl}/{(await SaveAsync(name)).GetProperty("id").GetGuid()}";
        using var someoneElse = await SignUpAsync();

        var theirList = await ReadJsonAsync(await someoneElse.GetAsync($"{CalculationsUrl}?search={name}"));
        var get = await someoneElse.GetAsync(url);
        var put = await someoneElse.PutAsJsonAsync(url, SaveBody("Hijacked"));
        var delete = await someoneElse.DeleteAsync(url);
        var mine = await Me.GetAsync(url);

        Assert.Multiple(() =>
        {
            Assert.That(theirList.GetArrayLength(), Is.Zero, "it is not in their list");
            Assert.That(get.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), "reading it is a 404, so its existence is not revealed");
            Assert.That(put.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), "it cannot be changed");
            Assert.That(delete.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), "or deleted");
            Assert.That(mine.StatusCode, Is.EqualTo(HttpStatusCode.OK), "and it is still mine");
        });
    }
}
