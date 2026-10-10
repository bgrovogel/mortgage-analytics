using FluentValidation.Results;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Application.Tests.Validation;

/// <summary>
/// Base class for validator tests. Every check goes through <c>Assert.That</c> with a message,
/// and a failure lists the errors that were actually produced.
/// </summary>
public abstract class ValidatorTestBase
{
    /// <summary>The validator under test; a fresh instance per test.</summary>
    protected AmortizationRequestValidator Validator { get; private set; } = null!;

    [SetUp]
    public void CreateValidator() => Validator = new AmortizationRequestValidator();

    /// <summary>Asserts that <paramref name="request"/> passes every rule.</summary>
    protected void AssertValid(AmortizationRequest request, string because)
    {
        var result = Validator.Validate(request);

        Assert.That(result.Errors, Is.Empty, $"{because}; errors were: {Describe(result)}");
    }

    /// <summary>Asserts that <paramref name="request"/> fails with an error on <paramref name="propertyPath"/>.</summary>
    protected void AssertInvalid(AmortizationRequest request, string propertyPath, string because)
    {
        var result = Validator.Validate(request);

        Assert.That(result.Errors.Select(e => e.PropertyName), Has.Member(propertyPath), $"{because}; errors were: {Describe(result)}");
    }

    /// <summary>Asserts that <paramref name="request"/> passes the rules for <paramref name="propertyPath"/>.</summary>
    protected void AssertNoErrorFor(AmortizationRequest request, string propertyPath, string because)
    {
        var result = Validator.Validate(request);

        Assert.That(result.Errors.Select(e => e.PropertyName), Has.No.Member(propertyPath), $"{because}; errors were: {Describe(result)}");
    }

    /// <summary>Asserts that the error on <paramref name="propertyPath"/> reads exactly <paramref name="message"/>.</summary>
    protected void AssertErrorMessage(AmortizationRequest request, string propertyPath, string message, string because)
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
