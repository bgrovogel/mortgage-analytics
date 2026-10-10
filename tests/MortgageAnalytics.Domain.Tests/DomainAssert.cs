namespace MortgageAnalytics.Domain.Tests;

/// <summary>Assertions shared by the domain tests.</summary>
internal static class DomainAssert
{
    /// <summary>
    /// Asserts that <paramref name="act"/> breaks a domain rule, and that the error names the rule,
    /// so a test can tell which of several guards fired.
    /// </summary>
    /// <param name="act">The code expected to throw, usually a constructor call.</param>
    /// <param name="messageContains">Text the exception message must contain.</param>
    /// <param name="because">What the rule protects against.</param>
    public static void Rejects(Func<object?> act, string messageContains, string because) =>
        Assert.That(
            () => act(),
            Throws.TypeOf<DomainValidationException>().With.Message.Contains(messageContains),
            because);

    /// <summary>Asserts that <paramref name="act"/> is accepted by every domain guard.</summary>
    public static void Accepts(Func<object?> act, string because) =>
        Assert.That(() => act(), Throws.Nothing, because);
}
