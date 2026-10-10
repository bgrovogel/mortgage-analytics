using FluentValidation;
using FluentValidation.Results;

namespace MortgageAnalytics.Application.Tests.Validation;

/// <summary>
/// Base class for validator tests. Every check goes through <c>Assert.That</c> with a message,
/// and a failure lists the errors that were actually produced.
/// </summary>
/// <typeparam name="TRequest">The request type being validated.</typeparam>
/// <typeparam name="TValidator">The validator under test.</typeparam>
public abstract class ValidatorTestBase<TRequest, TValidator>
    where TValidator : IValidator<TRequest>, new()
{
    /// <summary>The validator under test; a fresh instance per test.</summary>
    protected TValidator Validator { get; private set; } = default!;

    [SetUp]
    public void CreateValidator() => Validator = new TValidator();

    /// <summary>Asserts that <paramref name="request"/> passes every rule.</summary>
    protected void AssertValid(TRequest request, string because)
    {
        var result = Validator.Validate(request);

        Assert.That(result.Errors, Is.Empty, $"{because}; errors were: {Describe(result)}");
    }

    /// <summary>Asserts that <paramref name="request"/> fails with an error on <paramref name="propertyPath"/>.</summary>
    protected void AssertInvalid(TRequest request, string propertyPath, string because)
    {
        var result = Validator.Validate(request);

        Assert.That(result.Errors.Select(e => e.PropertyName), Has.Member(propertyPath), $"{because}; errors were: {Describe(result)}");
    }

    /// <summary>Asserts that <paramref name="request"/> passes the rules for <paramref name="propertyPath"/>.</summary>
    protected void AssertNoErrorFor(TRequest request, string propertyPath, string because)
    {
        var result = Validator.Validate(request);

        Assert.That(result.Errors.Select(e => e.PropertyName), Has.No.Member(propertyPath), $"{because}; errors were: {Describe(result)}");
    }

    /// <summary>Asserts that the error on <paramref name="propertyPath"/> reads exactly <paramref name="message"/>.</summary>
    protected void AssertErrorMessage(TRequest request, string propertyPath, string message, string because)
    {
        var result = Validator.Validate(request);

        Assert.That(
            result.Errors.Where(e => e.PropertyName == propertyPath).Select(e => e.ErrorMessage),
            Has.Member(message),
            $"{because}; errors were: {Describe(result)}");
    }

    private static string Describe(ValidationResult result) =>
        result.IsValid ? "(none)" : string.Join("; ", result.Errors.Select(e => $"{e.PropertyName}: {e.ErrorMessage}"));
}
