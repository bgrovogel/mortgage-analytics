using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

/// <summary>
/// The APR: the yearly rate at which the payments repay what the borrower actually got, which is the loan less the
/// charges paid up front (Regulation Z's actuarial method, with a monthly unit period). The loan is $377,650 at 6.25%
/// over 30 years, a payment of $2,325.26. Expected values come from an independent bisection in Python's Decimal.
/// </summary>
[TestFixture]
public class AnnualPercentageRateTests
{
    private static decimal[] Level(decimal payment, int months) => Enumerable.Repeat(payment, months).ToArray();

    [Test]
    public void WithNoCharges_IsTheNoteRate()
    {
        Assert.That(AnnualPercentageRate.Of(377_650m, Level(2_325.26m, 360)), Is.EqualTo(6.250m), "nothing paid up front: the rate itself");
    }

    [Test]
    public void ChargesPaidUpFront_RaiseIt()
    {
        // $4,000 of loan costs and $970.05 of prepaid interest leave $372,679.95 of the loan actually received.
        Assert.That(AnnualPercentageRate.Of(372_679.95m, Level(2_325.26m, 360)), Is.EqualTo(6.376m), "the same payments for less money");
    }

    [Test]
    public void MortgageInsuranceInThePayments_RaisesItFurther()
    {
        var payments = Level(2_325.26m + 157.35m, 100).Concat(Level(2_325.26m, 260)).ToArray();

        Assert.That(AnnualPercentageRate.Of(372_679.95m, payments), Is.EqualTo(6.692m), "$157.35 of PMI for the first 100 payments");
    }

    [Test]
    public void ALoanWithNoInterest_IsZero()
    {
        Assert.That(AnnualPercentageRate.Of(120_000m, Level(1_000m, 120)), Is.EqualTo(0m), "the payments return exactly what was received");
    }

    [TestCase(0, 1)]
    [TestCase(-100, 1)]
    public void WithNothingReceived_HasNone(decimal amount, int months)
    {
        Assert.That(AnnualPercentageRate.Of(amount, Level(100m, months)), Is.Null, "no loan to put a rate on");
    }

    [Test]
    public void PaymentsThatReturnLessThanWasReceived_HaveNone()
    {
        Assert.Multiple(() =>
        {
            Assert.That(AnnualPercentageRate.Of(10_000m, Level(50m, 100)), Is.Null, "$5,000 back for $10,000: a negative rate is not an APR");
            Assert.That(AnnualPercentageRate.Of(10_000m, []), Is.Null, "no payments at all");
        });
    }

    [Test]
    public void MoreChargesUpFront_MeanAHigherRate()
    {
        var payments = Level(2_325.26m, 360);

        Assert.That(AnnualPercentageRate.Of(370_000m, payments), Is.GreaterThan(AnnualPercentageRate.Of(375_000m, payments)!.Value),
            "receiving less for the same payments costs more");
    }
}
