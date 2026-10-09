using MortgageAnalytics.Domain.ExtraPayments;

namespace MortgageAnalytics.Domain.Tests.ExtraPayments;

[TestFixture]
public class ExtraPaymentRuleTests
{
    [TestCase(1, 0)]
    [TestCase(2, 0)]
    [TestCase(3, 100)]
    [TestCase(300, 100)]
    public void Monthly_AppliesFromStartingPaymentOnward(int paymentNumber, decimal expected)
    {
        var rule = new MonthlyExtraPayment(100m, startingPaymentNumber: 3);

        Assert.That(rule.AmountFor(paymentNumber), Is.EqualTo(expected));
    }

    [TestCase(5, 0)]
    [TestCase(6, 1_000)]
    [TestCase(7, 0)]
    [TestCase(18, 1_000)]
    [TestCase(30, 1_000)]
    [TestCase(31, 0)]
    public void Annual_AppliesEveryTwelvePaymentsFromFirstPayment(int paymentNumber, decimal expected)
    {
        var rule = new AnnualExtraPayment(1_000m, firstPaymentNumber: 6);

        Assert.That(rule.AmountFor(paymentNumber), Is.EqualTo(expected));
    }

    [Test]
    public void Annual_DefaultsToTheTwelfthPayment()
    {
        var rule = new AnnualExtraPayment(1_000m);

        Assert.Multiple(() =>
        {
            Assert.That(rule.AmountFor(11), Is.Zero);
            Assert.That(rule.AmountFor(12), Is.EqualTo(1_000m));
            Assert.That(rule.AmountFor(24), Is.EqualTo(1_000m));
        });
    }

    [TestCase(23, 0)]
    [TestCase(24, 5_000)]
    [TestCase(25, 0)]
    public void LumpSum_AppliesOnlyOnItsPayment(int paymentNumber, decimal expected)
    {
        var rule = new LumpSumExtraPayment(5_000m, paymentNumber: 24);

        Assert.That(rule.AmountFor(paymentNumber), Is.EqualTo(expected));
    }

    [Test]
    public void Rules_RejectNegativeAmountsAndPaymentNumbersBelowOne()
    {
        Assert.Multiple(() =>
        {
            Assert.Throws<DomainValidationException>(() => _ = new MonthlyExtraPayment(-1m));
            Assert.Throws<DomainValidationException>(() => _ = new AnnualExtraPayment(100m, 0));
            Assert.Throws<DomainValidationException>(() => _ = new LumpSumExtraPayment(100m, 0));
        });
    }

    [Test]
    public void Plan_SumsEveryRuleForAPayment()
    {
        var plan = new ExtraPaymentPlan(
        [
            new MonthlyExtraPayment(100m),
            new AnnualExtraPayment(1_000m, 12),
            new LumpSumExtraPayment(5_000m, 12),
        ]);

        Assert.Multiple(() =>
        {
            Assert.That(plan.AmountFor(1), Is.EqualTo(100m));
            Assert.That(plan.AmountFor(12), Is.EqualTo(6_100m));
            Assert.That(plan.AmountFor(24), Is.EqualTo(1_100m));
        });
    }

    [Test]
    public void Plan_RoundsTheTotalToCents()
    {
        var plan = new ExtraPaymentPlan([new MonthlyExtraPayment(10.005m)]);

        Assert.That(plan.AmountFor(1), Is.EqualTo(10.01m));
    }

    [Test]
    public void None_IsEmptyAndContributesNothing()
    {
        Assert.Multiple(() =>
        {
            Assert.That(ExtraPaymentPlan.None.IsEmpty, Is.True);
            Assert.That(ExtraPaymentPlan.None.AmountFor(1), Is.Zero);
        });
    }
}
