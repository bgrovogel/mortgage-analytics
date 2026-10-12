using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// The version in each saved calculation's JSON, and the upgrades that bring an old save up to date as it loads. The
/// app is at version 1 with no upgrades yet, so the mechanism is tested with a made-up format at version 3.
/// </summary>
[TestFixture]
public class StoredJsonTests : RepositoryTestBase
{
    private sealed record Loan(string? Name, decimal Amount);

    /// <summary>Version 1 called the name "title"; version 2 kept the amount in thousands; version 3 is <see cref="Loan"/>.</summary>
    private static readonly StoredJson<Loan> ThreeVersions = new(currentVersion: 3, upgrades: new Dictionary<int, Action<JsonObject>>
    {
        [1] = json =>
        {
            json["name"] = json["title"]?.DeepClone();
            json.Remove("title");
        },
        [2] = json => json["amount"] = json["amount"]!.GetValue<decimal>() * 1_000m,
    });

    [Test]
    public void Writing_StampsTheCurrentVersion()
    {
        var json = JsonNode.Parse(ThreeVersions.Write(new Loan("Oak St", 300_000m)))!.AsObject();

        Assert.That(json["formatVersion"]!.GetValue<int>(), Is.EqualTo(3), "every save says which format it was written in");
    }

    [Test]
    public void ASaveFromAnOlderVersion_IsUpgradedStepByStep_AsItLoads()
    {
        var fromVersion1 = ThreeVersions.Read("""{"title":"Oak St","amount":300,"formatVersion":1}""");
        var fromVersion2 = ThreeVersions.Read("""{"name":"Oak St","amount":300,"formatVersion":2}""");

        Assert.Multiple(() =>
        {
            Assert.That(fromVersion1, Is.EqualTo(new Loan("Oak St", 300_000m)), "version 1 goes through both upgrades, in order");
            Assert.That(fromVersion2, Is.EqualTo(new Loan("Oak St", 300_000m)), "version 2 only through the second");
        });
    }

    [Test]
    public void ASaveWithNoVersion_IsVersion1_TheFormatBeforeVersions()
    {
        Assert.That(ThreeVersions.Read("""{"title":"Oak St","amount":300}"""), Is.EqualTo(new Loan("Oak St", 300_000m)),
            "saves written before the version existed are the first format");
    }

    [Test]
    public void ASaveFromANewerVersion_IsRefused_RatherThanHalfRead()
    {
        Assert.That(() => ThreeVersions.Read("""{"name":"Oak St","amount":300000,"formatVersion":4}"""),
            Throws.InvalidOperationException.With.Message.Contains("format 4").And.Message.Contains("format 3"),
            "an older app cannot know what a newer one changed, so it says so instead of dropping values");
    }

    [Test]
    public void AnUpgradeMustExist_ForEveryStep()
    {
        Assert.That(() => new StoredJson<Loan>(currentVersion: 3, upgrades: new Dictionary<int, Action<JsonObject>> { [1] = _ => { } }),
            Throws.ArgumentException.With.Message.Contains("2"), "a missing step would load some saves wrongly, so it is caught at startup");
    }

    [Test]
    public async Task TheAppsSaves_AreVersion1_InTheDatabase()
    {
        var saved = ACalculation("Oak St");
        await SeedAsync(saved);

        await using var context = NewContext();
        var stored = await context.Database.SqlQuery<string>($"SELECT Inputs AS Value FROM SavedCalculations WHERE Id = {saved.Id}").SingleAsync();

        Assert.That(JsonNode.Parse(stored)!["formatVersion"]!.GetValue<int>(), Is.EqualTo(StoredJson.CurrentVersion),
            "each row says which format it is in, so a later app knows whether to upgrade it");
    }
}
