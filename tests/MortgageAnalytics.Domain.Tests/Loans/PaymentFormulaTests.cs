using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

[TestFixture]
public class PaymentFormulaTests
{
    // Expected values cross-checked against an independent Python Decimal implementation
    // and published mortgage tables.
    [TestCase(200_000, 6.0, 360, 1199.10)]
    [TestCase(350_000, 6.875, 360, 2299.25)]
    [TestCase(250_000, 7.5, 180, 2317.53)]
    [TestCase(1_000, 12.0, 12, 88.85)]
    [TestCase(100_000, 0.0, 120, 833.33)]
    public void MonthlyPayment_MatchesKnownValues(decimal principal, decimal annualRate, int months, decimal expected)
    {
        var payment = PaymentFormula.MonthlyPayment(principal, annualRate / 100m / 12m, months);

        Assert.That(payment, Is.EqualTo(expected), $"{principal:C} at {annualRate}% over {months} months");
    }

    [Test]
    public void MonthlyPayment_SinglePeriod_IsPrincipalPlusOneMonthOfInterest()
    {
        var payment = PaymentFormula.MonthlyPayment(12_000m, 0.01m, 1);

        Assert.That(payment, Is.EqualTo(12_120m), "a one-payment loan repays the principal plus one month of interest");
    }

    [TestCase(0)]
    [TestCase(-1)]
    public void MonthlyPayment_NonPositiveTerm_IsRejected(int months)
    {
        DomainAssert.Rejects(
            () => PaymentFormula.MonthlyPayment(1_000m, 0.01m, months),
            "Number of payments",
            "a loan must have at least one payment, otherwise the formula divides by zero");
    }
}
