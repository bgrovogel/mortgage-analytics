using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace MortgageAnalytics.Conventions.Tests;

/// <summary>
/// The team's assertion standards, enforced on every test file:
/// <list type="number">
///   <item>Only the constraint model: <c>Assert.That</c> and <c>Assert.Multiple</c>.</item>
///   <item>Every <c>Assert.That</c> has a failure message.</item>
///   <item>A method with more than one assertion wraps them all in <c>Assert.Multiple</c>.</item>
/// </list>
/// </summary>
[TestFixture]
public class AssertionConventionTests
{
    private static readonly string[] AllowedAssertMembers = ["That", "Multiple"];

    [Test]
    public void TestFiles_AreFound()
    {
        Assert.That(TestSourceFiles.All, Has.Count.GreaterThan(10), "the convention tests must actually be scanning the test projects");
    }

    [Test]
    public void OnlyConstraintModelAssertionsAreUsed()
    {
        var violations = TestSourceFiles.AssertInvocations()
            .Where(invocation => !AllowedAssertMembers.Contains(TestSourceFiles.MemberName(invocation)))
            .Select(invocation => $"{TestSourceFiles.Location(invocation)}  Assert.{TestSourceFiles.MemberName(invocation)}")
            .ToList();

        Assert.That(violations, Is.Empty,
            "use Assert.That(actual, constraint, message), e.g. Assert.That(() => act(), Throws.TypeOf<T>(), \"why\"), instead of:\n"
            + string.Join('\n', violations));
    }

    [Test]
    public void EveryAssertThat_HasAFailureMessage()
    {
        // Assert.That(actual, constraint, message): the third argument is the message.
        var violations = TestSourceFiles.AssertInvocations()
            .Where(invocation => TestSourceFiles.MemberName(invocation) == "That" && invocation.ArgumentList.Arguments.Count < 3)
            .Select(TestSourceFiles.Location)
            .ToList();

        Assert.That(violations, Is.Empty,
            "every Assert.That needs a message explaining what a failure means:\n" + string.Join('\n', violations));
    }

    [Test]
    public void MethodsWithSeveralAssertions_WrapThemInAssertMultiple()
    {
        var violations = TestSourceFiles.All
            .SelectMany(tree => tree.GetRoot().DescendantNodes().OfType<BaseMethodDeclarationSyntax>())
            .Where(method => AssertThatsIn(method).Count > 1 && AssertThatsIn(method).Any(a => !IsInsideAssertMultiple(a)))
            .Select(method => $"{TestSourceFiles.Location(method)}  {NameOf(method)}")
            .ToList();

        Assert.That(violations, Is.Empty,
            "methods with more than one Assert.That must put them all inside Assert.Multiple:\n" + string.Join('\n', violations));
    }

    private static List<InvocationExpressionSyntax> AssertThatsIn(SyntaxNode method) =>
        method.DescendantNodes()
            .OfType<InvocationExpressionSyntax>()
            .Where(i => i.Expression is MemberAccessExpressionSyntax
            {
                Expression: IdentifierNameSyntax { Identifier.Text: "Assert" },
                Name.Identifier.Text: "That",
            })
            .ToList();

    private static bool IsInsideAssertMultiple(SyntaxNode node) =>
        node.Ancestors()
            .OfType<InvocationExpressionSyntax>()
            .Any(a => a.Expression is MemberAccessExpressionSyntax
            {
                Expression: IdentifierNameSyntax { Identifier.Text: "Assert" },
                Name.Identifier.Text: "Multiple",
            });

    private static string NameOf(BaseMethodDeclarationSyntax method) =>
        method is MethodDeclarationSyntax named ? named.Identifier.Text : method.Kind().ToString();
}
