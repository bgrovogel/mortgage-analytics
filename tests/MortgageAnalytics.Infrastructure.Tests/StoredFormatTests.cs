using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// Saved calculations are stored as their request's JSON, so a renamed or removed field would quietly drop that value
/// from everyone's saves. StoredFormats/ holds one save of each kind, every option set, exactly as stored today; each
/// must still load with every value intact. New fields are fine (old saves load them as their defaults). If one of
/// these fails, the change is breaking for saved data: keep the old name, or raise StoredJson.CurrentVersion and add
/// an upgrade from the old format.
/// </summary>
[TestFixture]
public class StoredFormatTests : RepositoryTestBase
{
    // The shape the database stores (see CalculationsDbContext).
    private static readonly JsonSerializerOptions StoredJson = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [TestCase("calculator.json", "Inputs")]
    [TestCase("refinance.json", "Refinance")]
    [TestCase("strategy.json", "Strategy")]
    [TestCase("calculator.json", "SecondHome")] // a compared home is stored in the calculator's format
    public async Task ASaveInTodaysFormat_StillLoads_WithEveryValue(string file, string column)
    {
        var stored = await File.ReadAllTextAsync(Path.Combine(TestContext.CurrentContext.TestDirectory, "StoredFormats", file));
        var saved = ACalculation("Stored");
        saved.Inputs = null;
        await SeedAsync(saved);
        int rowsWritten;
        await using (var context = NewContext())
        {
            var write = column switch
            {
                "Inputs" => context.Database.ExecuteSqlAsync($"UPDATE SavedCalculations SET Inputs = {stored} WHERE Id = {saved.Id}"),
                "Refinance" => context.Database.ExecuteSqlAsync($"UPDATE SavedCalculations SET Refinance = {stored} WHERE Id = {saved.Id}"),
                "SecondHome" => context.Database.ExecuteSqlAsync($"UPDATE SavedCalculations SET SecondHome = {stored} WHERE Id = {saved.Id}"),
                _ => context.Database.ExecuteSqlAsync($"UPDATE SavedCalculations SET Strategy = {stored} WHERE Id = {saved.Id}"),
            };
            rowsWritten = await write;
        }

        var found = await NewRepository().FindAsync(Alice, saved.Id, CancellationToken.None);
        object? loaded = column switch
        {
            "Inputs" => found?.Inputs, "Refinance" => found?.Refinance, "SecondHome" => found?.SecondHome, _ => found?.Strategy,
        };
        var reloaded = loaded is null ? default : JsonSerializer.SerializeToElement(loaded, loaded.GetType(), StoredJson);

        Assert.Multiple(() =>
        {
            Assert.That(rowsWritten, Is.EqualTo(1), "the stored JSON is written into the saved row");
            Assert.That(loaded, Is.Not.Null, $"{file} loads");
            Assert.That(MissingOrChanged(JsonDocument.Parse(stored).RootElement, reloaded, "$"), Is.Empty,
                $"every value stored in {file} comes back: a field listed here was renamed, removed or changed type");
        });
    }

    /// <summary>The paths of values in <paramref name="expected"/> that <paramref name="actual"/> lacks or holds differently.</summary>
    private static IEnumerable<string> MissingOrChanged(JsonElement expected, JsonElement actual, string path)
    {
        if (expected.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in expected.EnumerateObject())
            {
                if (actual.ValueKind != JsonValueKind.Object || !actual.TryGetProperty(property.Name, out var value))
                    yield return $"{path}.{property.Name}";
                else
                    foreach (var problem in MissingOrChanged(property.Value, value, $"{path}.{property.Name}"))
                        yield return problem;
            }
        }
        else if (expected.ValueKind == JsonValueKind.Array)
        {
            var items = actual.ValueKind == JsonValueKind.Array ? actual.EnumerateArray().ToList() : [];
            var index = 0;
            foreach (var item in expected.EnumerateArray())
            {
                if (index >= items.Count) yield return $"{path}[{index}]";
                else foreach (var problem in MissingOrChanged(item, items[index], $"{path}[{index}]")) yield return problem;
                index++;
            }
        }
        else if (expected.ValueKind == JsonValueKind.Number
            ? actual.ValueKind != JsonValueKind.Number || expected.GetDecimal() != actual.GetDecimal()
            : expected.ToString() != actual.ToString() || expected.ValueKind != actual.ValueKind)
        {
            yield return path;
        }
    }
}
