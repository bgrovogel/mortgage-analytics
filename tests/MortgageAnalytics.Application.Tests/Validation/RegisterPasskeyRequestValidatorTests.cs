using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Application.Tests.Validation;

[TestFixture]
public class RegisterPasskeyRequestValidatorTests : ValidatorTestBase<RegisterPasskeyRequest, RegisterPasskeyRequestValidator>
{
    private static RegisterPasskeyRequest Named(string name) => new() { Name = name, State = "a-state" };

    [Test]
    public void ANamedPasskey_WithAState_IsValid() => AssertValid(Named("MacBook"), "a name and the ceremony's state are all it needs");

    [TestCase("")]
    [TestCase("   ")]
    public void ABlankName_IsRejected(string name) =>
        AssertErrorMessage(Named(name), "Name", "Give the passkey a name.", "a passkey is told apart by its name");

    [Test]
    public void ANameTooLong_IsRejected() =>
        AssertInvalid(Named(new string('a', RegisterPasskeyRequestValidator.MaxNameLength + 1)), "Name", "a name has a limit, after trimming");

    [Test]
    public void ANameAtTheLimit_IsAccepted() =>
        AssertValid(Named($"  {new string('a', RegisterPasskeyRequestValidator.MaxNameLength)}  "), "the limit counts the trimmed name");

    [Test]
    public void NoState_IsRejected() =>
        AssertInvalid(new RegisterPasskeyRequest { Name = "x" }, "State", "the answer must say which ceremony it finishes");

    [Test]
    public void AStateFarLargerThanAnyRealOne_IsRejected() =>
        AssertInvalid(new RegisterPasskeyRequest { Name = "x", State = new string('a', RegisterPasskeyRequestValidator.MaxCeremonyLength + 1) }, "State", "a bound on what is unsealed");
}
