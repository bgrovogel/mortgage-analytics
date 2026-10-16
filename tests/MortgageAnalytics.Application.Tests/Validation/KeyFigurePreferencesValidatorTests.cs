using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Application.Tests.Validation;

[TestFixture]
public class KeyFigurePreferencesValidatorTests : ValidatorTestBase<KeyFigurePreferences, KeyFigurePreferencesValidator>
{
    [Test]
    public void AnArrangement_OfNamedFigures_IsValid() =>
        AssertValid(new KeyFigurePreferences { Order = ["payoff", "cash", "pmi"], Hidden = ["pmi"] }, "names in an order, some put away");

    [Test]
    public void NoArrangement_IsValid() =>
        AssertValid(new KeyFigurePreferences(), "an empty arrangement is how a user starts, and how they go back to the page's own");

    [TestCase("")]
    [TestCase("Cash To Close")]
    [TestCase("cash_to_close")]
    [TestCase("1cash")]
    public void AFigureNameThatIsNotAName_IsRejected(string name) =>
        AssertInvalid(new KeyFigurePreferences { Order = [name] }, "Order[0]", "names are short lowercase words, so nothing else is stored");

    [Test]
    public void AFigureNameTooLong_IsRejected() =>
        AssertInvalid(new KeyFigurePreferences { Hidden = [new string('a', KeyFigurePreferencesValidator.MaxNameLength + 1)] }, "Hidden[0]", "a name has a limit");

    [Test]
    public void MoreFigures_ThanTheLimit_AreRejected() =>
        AssertInvalid(new KeyFigurePreferences { Order = [.. Enumerable.Range(0, KeyFigurePreferencesValidator.MaxFigures + 1).Select(i => $"figure{i}")] }, "Order",
            "the page has a handful of figures, not hundreds");

    [Test]
    public void AListLeftNull_IsRejected() =>
        AssertInvalid(new KeyFigurePreferences { Order = null!, Hidden = [null!] }, "Order", "JSON can say null where a list is expected, and null is not an arrangement");

    [Test]
    public void ANullName_IsRejected() =>
        AssertInvalid(new KeyFigurePreferences { Hidden = [null!] }, "Hidden[0]", "a null is not a name");

    [Test]
    public void ARepeatedFigure_IsRejected() =>
        AssertInvalid(new KeyFigurePreferences { Order = ["cash", "cash"] }, "Order", "a figure has one place in the order");
}
