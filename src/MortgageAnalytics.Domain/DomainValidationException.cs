namespace MortgageAnalytics.Domain;

/// <summary>
/// Thrown when a domain invariant is violated. The API validates input before it reaches the
/// domain, so this exception signals a programming error rather than bad user input.
/// </summary>
/// <param name="message">What rule was broken.</param>
public sealed class DomainValidationException(string message) : Exception(message);
