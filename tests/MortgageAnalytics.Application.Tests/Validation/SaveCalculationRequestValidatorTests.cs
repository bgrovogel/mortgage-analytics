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
    public void ANameLeftOut_IsRejected() =>
        AssertErrorMessage(new SaveCalculationRequest { Inputs = A.Request.Build() }, "Name", "Give the calculation a name.",
            "a request with no name at all starts blank, and a blank name is refused");

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
    public void TwoHomes_CanBeSavedAsOneComparison() =>
        AssertValid(new SaveCalculationRequest { Name = "Oak St or Elm St", Inputs = A.Request.Build(), OtherHomes = [A.Request.Build() with { HomePrice = 450_000m }] },
            "a comparison is the calculator's inputs plus another home's");

    [Test]
    public void FourHomes_CanBeSavedAsOneComparison() =>
        AssertValid(new SaveCalculationRequest
        {
            Name = "Four streets", Inputs = A.Request.Build(),
            OtherHomes = [A.Request.Build() with { HomePrice = 400_000m }, A.Request.Build() with { HomePrice = 450_000m }, A.Request.Build() with { HomePrice = 500_000m }],
        }, "the calculator's inputs and three more");

    [Test]
    public void FiveHomes_AreRejected() =>
        AssertErrorMessage(new SaveCalculationRequest { Name = "Five", Inputs = A.Request.Build(), OtherHomes = [.. Enumerable.Repeat(A.Request.Build(), 4)] },
            "OtherHomes", "Compare up to 4 homes: the calculator inputs and up to 3 more.", "the Compare tab holds four homes");

    [Test]
    public void NoOtherHomes_AreRejected() =>
        AssertErrorMessage(new SaveCalculationRequest { Name = "One", Inputs = A.Request.Build(), OtherHomes = [] },
            "OtherHomes", "Compare up to 4 homes: the calculator inputs and up to 3 more.", "an empty list compares nothing; leave it out to save a purchase");

    [Test]
    public void OtherHomesAlone_AreRejected() =>
        AssertErrorMessage(new SaveCalculationRequest { Name = "Half", OtherHomes = [A.Request.Build()] }, "OtherHomes",
            "Other homes are compared with the calculator inputs: include those too.", "there is nothing to compare them with");

    [Test]
    public void OtherHomesWithAnotherKind_AreRejected() =>
        AssertErrorMessage(new SaveCalculationRequest { Name = "Mixed", Refinance = ARefinance(), OtherHomes = [A.Request.Build()] }, "OtherHomes",
            "Other homes are compared with the calculator inputs: include those too.", "a refinance has no house to compare");

    [Test]
    public void AnInvalidOtherHome_IsRejectedWithTheSameRulesAsTheCalculator() =>
        AssertInvalid(new SaveCalculationRequest { Name = "Bad", Inputs = A.Request.Build(), OtherHomes = [A.Request.Build(), A.Request.Build() with { HomePrice = 0 }] },
            "OtherHomes[1].HomePrice", "each home must be one the calculator would accept; the error names the house");

    [Test]
    public void InvalidRefinanceInputs_AreRejectedWithTheRefinanceRules() =>
        AssertInvalid(new SaveCalculationRequest { Name = "Bad", Refinance = ARefinance() with { CurrentBalance = 0 } },
            "Refinance.CurrentBalance", "the comparison must be one the refinance endpoint would accept");
}
