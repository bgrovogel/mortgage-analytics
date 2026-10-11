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

        Assert.That(rule.AmountFor(paymentNumber), Is.EqualTo(expected), $"payment {paymentNumber} with a monthly extra starting at payment 3");
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

        Assert.That(rule.AmountFor(paymentNumber), Is.EqualTo(expected), $"payment {paymentNumber} with an annual extra on payments 6, 18, 30, ...");
    }

    // Counted from the first payment, not from payment 0: from payment 3, payment 9 is half a year in, not a year.
    [TestCase(9, 0)]
    [TestCase(15, 1_000)]
    public void Annual_CountsItsYearsFromItsOwnFirstPayment(int paymentNumber, decimal expected)
    {
        var rule = new AnnualExtraPayment(1_000m, firstPaymentNumber: 3);

        Assert.That(rule.AmountFor(paymentNumber), Is.EqualTo(expected), $"payment {paymentNumber} with an annual extra on payments 3, 15, 27, ...");
    }

    [TestCase(11, 0)]
    [TestCase(12, 1_000)]
    [TestCase(24, 1_000)]
    public void Annual_DefaultsToTheTwelfthPayment(int paymentNumber, decimal expected)
    {
        var rule = new AnnualExtraPayment(1_000m);

        Assert.That(rule.AmountFor(paymentNumber), Is.EqualTo(expected), "by default the annual extra lands on every 12th payment");
    }

    [TestCase(23, 0)]
    [TestCase(24, 5_000)]
    [TestCase(25, 0)]
    public void LumpSum_AppliesOnlyOnItsPayment(int paymentNumber, decimal expected)
    {
        var rule = new LumpSumExtraPayment(5_000m, paymentNumber: 24);

        Assert.That(rule.AmountFor(paymentNumber), Is.EqualTo(expected), "a lump sum is paid once, with payment 24");
    }

    private static IEnumerable<TestCaseData> InvalidRules()
    {
        yield return new TestCaseData(new Func<object>(() => new MonthlyExtraPayment(-1m)), "cannot be negative").SetName("Monthly: negative amount");
        yield return new TestCaseData(new Func<object>(() => new MonthlyExtraPayment(1m, 0)), "payment 1 or later").SetName("Monthly: starts before payment 1");
        yield return new TestCaseData(new Func<object>(() => new AnnualExtraPayment(-1m)), "cannot be negative").SetName("Annual: negative amount");
        yield return new TestCaseData(new Func<object>(() => new AnnualExtraPayment(100m, 0)), "payment 1 or later").SetName("Annual: starts before payment 1");
        yield return new TestCaseData(new Func<object>(() => new LumpSumExtraPayment(-1m, 1)), "cannot be negative").SetName("Lump sum: negative amount");
        yield return new TestCaseData(new Func<object>(() => new LumpSumExtraPayment(100m, 0)), "payment 1 or later").SetName("Lump sum: before payment 1");
    }

    [TestCaseSource(nameof(InvalidRules))]
    public void Rules_RejectNegativeAmountsAndPaymentNumbersBelowOne(Func<object> create, string guard)
    {
        DomainAssert.Rejects(create, guard, "extra payments must be non-negative and start on a real payment");
    }

    [TestCase(1, 100)]
    [TestCase(12, 6_100)]
    [TestCase(24, 1_100)]
    public void Plan_SumsEveryRuleForAPayment(int paymentNumber, decimal expected)
    {
        var plan = new ExtraPaymentPlan(
        [
            new MonthlyExtraPayment(100m),
            new AnnualExtraPayment(1_000m, 12),
            new LumpSumExtraPayment(5_000m, 12),
        ]);

        Assert.That(plan.AmountFor(paymentNumber), Is.EqualTo(expected), $"payment {paymentNumber}: monthly + any annual + any lump sum");
    }

    [Test]
    public void Plan_RoundsTheTotalToCents()
    {
        var plan = new ExtraPaymentPlan([new MonthlyExtraPayment(10.005m)]);

        Assert.That(plan.AmountFor(1), Is.EqualTo(10.01m), "extra principal is money, so it is rounded to cents half away from zero");
    }

    [Test]
    public void None_IsEmptyAndContributesNothing()
    {
        Assert.Multiple(() =>
        {
            Assert.That(ExtraPaymentPlan.None.IsEmpty, Is.True, "the None plan holds no rules");
            Assert.That(ExtraPaymentPlan.None.AmountFor(1), Is.Zero, "the None plan adds no extra principal");
            Assert.That(ExtraPaymentPlan.None.LargestSinglePaymentFor(1), Is.Zero, "and no single payment");
        });
    }

    [TestCase(1, 100, TestName = "Only the monthly extra")]
    [TestCase(12, 5_000, TestName = "The lump sum is the largest of three payments")]
    [TestCase(24, 1_000, TestName = "The annual extra beats the monthly")]
    public void Plan_LargestSinglePayment_IsTheBiggestRuleNotTheTotal(int paymentNumber, decimal expected)
    {
        var plan = new ExtraPaymentPlan(
        [
            new MonthlyExtraPayment(100m),
            new AnnualExtraPayment(1_000m, 12),
            new LumpSumExtraPayment(5_000m, 12),
        ]);

        Assert.That(plan.LargestSinglePaymentFor(paymentNumber), Is.EqualTo(expected), "recasting depends on one payment, so the plan must report the largest, not the sum");
    }
}
