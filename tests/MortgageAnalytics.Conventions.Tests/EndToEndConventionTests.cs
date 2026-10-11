using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

namespace MortgageAnalytics.Conventions.Tests;

/// <summary>
/// The assertion-message standard applied to the Playwright end-to-end tests: every <c>expect(...)</c>
/// passes a message as its second argument, so a failure explains what it means.
/// </summary>
[TestFixture]
public partial class EndToEndConventionTests
{
    /// <summary>An <c>expect(</c> call and its arguments up to the matcher: <c>expect(actual, 'message').toBe(...)</c>.</summary>
    [GeneratedRegex(@"\bexpect\((?<args>.*?)\)\s*\.\s*(not\s*\.\s*)?to[A-Z]", RegexOptions.Singleline)]
    private static partial Regex ExpectCall();

    /// <summary>A message argument: a comma at the top level, followed by a string literal.</summary>
    [GeneratedRegex(@",\s*['""`]")]
    private static partial Regex MessageArgument();

    private static readonly string E2EFolder = FindE2EFolder();

    [Test]
    public void SpecFiles_AreFound()
    {
        Assert.That(Directory.EnumerateFiles(E2EFolder, "*.ts"), Is.Not.Empty, "the convention test must actually scan the e2e folder");
    }

    [Test]
    public void EveryPlaywrightExpect_HasAMessage()
    {
        var violations = Directory.EnumerateFiles(E2EFolder, "*.ts")
            .SelectMany(file => ExpectCall().Matches(File.ReadAllText(file))
                .Where(match => !MessageArgument().IsMatch(match.Groups["args"].Value))
                .Select(match => $"{Path.GetFileName(file)}:{LineOf(File.ReadAllText(file), match.Index)}  {match.Value.Split('\n')[0].Trim()}"))
            .ToList();

        Assert.That(violations, Is.Empty,
            "write expect(actual, 'what a failure means').toX(...):\n" + string.Join('\n', violations));
    }

    [Test]
    public void EverySpec_TakesItsTestFromTheFixtures()
    {
        var violations = Directory.EnumerateFiles(E2EFolder, "*.spec.ts")
            .Where(file => !FixturesImport().IsMatch(File.ReadAllText(file)))
            .Select(Path.GetFileName)
            .ToList();

        Assert.That(violations, Is.Empty,
            "import { expect, test } from './fixtures', so every test gets the shared checks (such as the Content-Security-Policy guard):\n"
            + string.Join('\n', violations));
    }

    /// <summary>An import of <c>test</c> from the shared fixtures file.</summary>
    [GeneratedRegex(@"import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*'\./fixtures'")]
    private static partial Regex FixturesImport();

    private static int LineOf(string text, int index) => text[..index].Count(c => c == '\n') + 1;

    /// <summary>client/e2e, found from this file's compile-time path so it works wherever the binaries are.</summary>
    private static string FindE2EFolder([CallerFilePath] string thisFile = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(thisFile)!, "..", "..", "client", "e2e"));
}
