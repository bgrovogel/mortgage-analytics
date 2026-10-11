using System.Runtime.CompilerServices;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// The API's contract (every path, schema, property, type, enum value and required field) against an approved copy
/// committed with the tests. The TypeScript models mirror the contracts by hand, so a renamed or removed field would
/// otherwise surface only in the browser tests, or in the browser. Here it fails in seconds, and the diff between the
/// received and approved files says exactly what the client has to follow.
/// </summary>
[TestFixture]
public class ContractSnapshotTests : ApiTestBase
{
    /// <summary>Prose that describes the API but is not its shape. The Swagger test checks the doc comments flow.</summary>
    private static readonly string[] DocumentationKeys = ["description", "summary", "example"];

    [Test]
    public async Task OpenApiDocument_MatchesTheApprovedContract()
    {
        var received = ContractOf(await Client.GetStringAsync("/swagger/v1/swagger.json"));
        var approved = File.Exists(ApprovedPath) ? File.ReadAllText(ApprovedPath).ReplaceLineEndings("\n") : "";

        if (received == approved)
            File.Delete(ReceivedPath);
        else
            File.WriteAllText(ReceivedPath, received);

        Assert.That(received, Is.EqualTo(approved),
            $"The API contract changed. Compare {Path.GetFileName(ReceivedPath)} with {Path.GetFileName(ApprovedPath)} in {SnapshotFolder}. "
            + "If the change is intended, update the TypeScript models in client/src/app/core/models to match, then copy the "
            + "received file over the approved one.");
    }

    /// <summary>The document without its prose, indented, with \n line endings, so only a change of shape differs.</summary>
    private static string ContractOf(string openApiJson)
    {
        var document = JsonNode.Parse(openApiJson)!;
        RemoveDocumentation(document, parentKey: null);
        // Relaxed escaping keeps "application/problem+json" readable in the diff; the file is never served.
        var options = new JsonSerializerOptions { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        return document.ToJsonString(options).ReplaceLineEndings("\n") + "\n";
    }

    /// <summary>
    /// Removes descriptions, summaries and examples at every level, except where a key is a name rather than a
    /// keyword: under "properties", a property may be called "description".
    /// </summary>
    private static void RemoveDocumentation(JsonNode? node, string? parentKey)
    {
        switch (node)
        {
            case JsonObject obj:
                if (parentKey != "properties")
                    foreach (var key in DocumentationKeys)
                        obj.Remove(key);
                foreach (var (key, child) in obj.ToList())
                    RemoveDocumentation(child, key);
                break;
            case JsonArray array:
                foreach (var item in array)
                    RemoveDocumentation(item, parentKey: null);
                break;
        }
    }

    private static readonly string SnapshotFolder = FindSnapshotFolder();
    private static string ApprovedPath => Path.Combine(SnapshotFolder, "openapi.v1.approved.json");
    private static string ReceivedPath => Path.Combine(SnapshotFolder, "openapi.v1.received.json");

    /// <summary>The Snapshots folder beside this file, found from its compile-time path so it works wherever the binaries are.</summary>
    private static string FindSnapshotFolder([CallerFilePath] string thisFile = "") =>
        Directory.CreateDirectory(Path.Combine(Path.GetDirectoryName(thisFile)!, "Snapshots")).FullName;
}
