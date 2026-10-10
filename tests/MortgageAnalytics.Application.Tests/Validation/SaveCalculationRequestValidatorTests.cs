using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Application.Tests.Validation;

[TestFixture]
public class SaveCalculationRequestValidatorTests : ValidatorTestBase<SaveCalculationRequest, SaveCalculationRequestValidator>
{
    private static SaveCalculationRequest Named(string name) => new() { Name = name, Inputs = A.Request.Build() };

    [Test]
    public void ANamedValidCalculation_IsValid() =>
        AssertValid(Named("Oak St, 20% down"), "a name and valid inputs are all a saved calculation needs");

    [TestCase("")]
    [TestCase("   ")]
    public void ABlankName_IsRejected(string name) =>
        AssertErrorMessage(Named(name), "Name", "Give the calculation a name.", "a blank name could not be found again");

    [Test]
    public void ANullName_IsRejectedRatherThanThrowing() =>
        AssertErrorMessage(Named(null!), "Name", "Give the calculation a name.", "JSON can send null for a string");

    [Test]
    public void ANameLongerThanTheLimit_IsRejected() =>
        AssertInvalid(Named(new string('a', SaveCalculationRequestValidator.MaxNameLength + 1)), "Name", "names are capped so lists stay readable");

    [Test]
    public void SurroundingSpaces_DoNotCountTowardTheLimit() =>
        AssertValid(Named($"  {new string('a', SaveCalculationRequestValidator.MaxNameLength)}  "), "the name is trimmed before it is stored");

    [Test]
    public void MissingInputs_AreRejected() =>
        AssertInvalid(new SaveCalculationRequest { Name = "Empty" }, "Inputs", "there is nothing to save without inputs");

    [Test]
    public void InvalidInputs_AreRejectedWithTheSameRulesAsTheCalculator()
    {
        var request = new SaveCalculationRequest { Name = "Bad", Inputs = A.Request.Build() with { HomePrice = 0 } };

        AssertInvalid(request, "Inputs.HomePrice", "inputs the calculator would reject cannot be saved; the error names the nested field");
    }
}
