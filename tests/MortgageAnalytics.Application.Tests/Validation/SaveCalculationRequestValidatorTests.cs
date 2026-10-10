using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;
using static MortgageAnalytics.Testing.ReferenceRefinances;

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

    private static RefinanceRequest ARefinance() => new()
    {
        CurrentBalance = Current.Balance,
        CurrentAnnualInterestRate = Current.AnnualInterestRate,
        RemainingTermInMonths = Current.RemainingTermInMonths,
        NewAnnualInterestRate = ToSixPercentFor30Years.AnnualInterestRate,
        NewTermInMonths = ToSixPercentFor30Years.TermInMonths,
        ClosingCosts = ToSixPercentFor30Years.ClosingCosts,
    };

    [Test]
    public void ARefinanceComparison_CanBeSavedInsteadOfCalculatorInputs() =>
        AssertValid(new SaveCalculationRequest { Name = "Refi at 6%", Refinance = ARefinance() }, "History holds refinance comparisons too");

    [Test]
    public void BothKindsOfInputsAtOnce_AreRejected() =>
        AssertErrorMessage(
            new SaveCalculationRequest { Name = "Both", Inputs = A.Request.Build(), Refinance = ARefinance() },
            "Inputs",
            "Include only one kind of inputs: calculator, refinance or pay-off-or-invest.",
            "a saved item is one kind of calculation");

    [Test]
    public void NoInputsAtAll_AreRejected() =>
        AssertErrorMessage(
            new SaveCalculationRequest { Name = "Empty" },
            "Inputs",
            "Include the calculator inputs, a refinance comparison or a pay-off-or-invest comparison to save.",
            "there must be something to save");

    [Test]
    public void APayOffOrInvestComparison_CanBeSavedToo() =>
        AssertValid(new SaveCalculationRequest { Name = "Pay off or invest", Strategy = ReferenceStrategies.TypicalRequest },
            "History holds strategy comparisons too");

    [Test]
    public void AStrategyWithAnotherKind_IsRejected() =>
        AssertErrorMessage(
            new SaveCalculationRequest { Name = "Two", Refinance = ARefinance(), Strategy = ReferenceStrategies.TypicalRequest },
            "Inputs",
            "Include only one kind of inputs: calculator, refinance or pay-off-or-invest.",
            "a saved item is one kind of calculation");

    [Test]
    public void InvalidStrategyInputs_AreRejectedWithTheStrategyRules() =>
        AssertInvalid(new SaveCalculationRequest { Name = "Bad", Strategy = ReferenceStrategies.TypicalRequest with { RemainingTermInMonths = 400 } },
            "Strategy.RemainingTermInMonths", "the comparison must be one the strategies endpoint would accept");

    [Test]
    public void InvalidRefinanceInputs_AreRejectedWithTheRefinanceRules() =>
        AssertInvalid(new SaveCalculationRequest { Name = "Bad", Refinance = ARefinance() with { CurrentBalance = 0 } },
            "Refinance.CurrentBalance", "the comparison must be one the refinance endpoint would accept");
}
