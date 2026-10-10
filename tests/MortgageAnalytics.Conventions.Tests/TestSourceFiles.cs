using System.Runtime.CompilerServices;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace MortgageAnalytics.Conventions.Tests;

/// <summary>Finds and parses every C# file in the test projects, once per test run.</summary>
internal static class TestSourceFiles
{
    private static readonly Lazy<IReadOnlyList<SyntaxTree>> Trees = new(Load);

    /// <summary>Every parsed test source file (bin and obj folders excluded).</summary>
    public static IReadOnlyList<SyntaxTree> All => Trees.Value;

    /// <summary>Every <c>Assert.*</c> invocation across all test files.</summary>
    public static IEnumerable<InvocationExpressionSyntax> AssertInvocations() =>
        All.SelectMany(tree => tree.GetRoot().DescendantNodes().OfType<InvocationExpressionSyntax>())
            .Where(invocation => invocation.Expression is MemberAccessExpressionSyntax
            {
                Expression: IdentifierNameSyntax { Identifier.Text: "Assert" },
            });

    /// <summary>The name of the <c>Assert</c> member being called, e.g. "That" or "Multiple".</summary>
    public static string MemberName(InvocationExpressionSyntax invocation) =>
        ((MemberAccessExpressionSyntax)invocation.Expression).Name.Identifier.Text;

    /// <summary>A clickable "path:line" for a syntax node, relative to the tests folder.</summary>
    public static string Location(SyntaxNode node)
    {
        var span = node.GetLocation().GetLineSpan();
        return $"{Path.GetRelativePath(TestsFolder, span.Path)}:{span.StartLinePosition.Line + 1}";
    }

    private static string TestsFolder { get; } = FindTestsFolder();

    private static List<SyntaxTree> Load() =>
        Directory.EnumerateFiles(TestsFolder, "*.cs", SearchOption.AllDirectories)
            .Where(path => !IsBuildOutput(path))
            .Select(path => CSharpSyntaxTree.ParseText(File.ReadAllText(path), path: path))
            .ToList();

    private static bool IsBuildOutput(string path) =>
        path.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            .Any(segment => segment is "bin" or "obj");

    /// <summary>
    /// The tests folder is two levels above this source file. The compile-time path is used, rather than the
    /// build output folder, so discovery works wherever the binaries are written.
    /// </summary>
    private static string FindTestsFolder([CallerFilePath] string thisFile = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(thisFile)!, ".."));
}
