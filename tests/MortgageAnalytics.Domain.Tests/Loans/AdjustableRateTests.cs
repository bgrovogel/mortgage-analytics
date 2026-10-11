using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

/// <summary>
/// Adjustable rates on the reference loan ($200,000 at 6% over 30 years, a $1,199.10 payment), as a 7/1 ARM: fixed
/// for 84 payments, then resetting every 12. Every expected value comes from the independent model in
/// tools/rate-check/rate_model.py.
/// </summary>
[TestFixture]
public class AdjustableRateTests
{
    private static readonly LoanTerms Fixed = new(200_000m, 6m, 360, new DateOnly(2026, 1, 1));
    private readonly AmortizationCalculator _calculator = new();

    private static AdjustableRate SevenOne(decimal expected, decimal initialCap, decimal periodicCap, decimal lifetimeCap) =>
        new(84, 12, expected, initialCap, periodicCap, lifetimeCap);

    private AmortizationSchedule Run(AdjustableRate arm) =>
        _calculator.Generate(Fixed.WithAdjustableRate(arm), ExtraPaymentPlan.None, RecastPolicy.Never);

    [Test]
    public void WithAdjustableRate_FollowsTheResets_FromTheLoansOwnRateAndTerm_AndNoneLeavesItFixed()
    {
        var arm = SevenOne(8m, 5m, 2m, 5m);

        Assert.Multiple(() =>
        {
            Assert.That(Fixed.WithAdjustableRate(arm).RateChanges, Is.EqualTo(arm.RatePath(6m, 360)), "the resets of a 6% loan over 360 payments");
            Assert.That(Fixed.WithAdjustableRate(null), Is.SameAs(Fixed), "a fixed rate leaves the loan as it is");
        });
    }

    [Test]
    public void ARateWithinTheFirstCap_IsReachedAtTheFirstReset_AndThePaymentReAmortizes()
    {
        var schedule = Run(SevenOne(7.5m, 5m, 2m, 5m));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.RateChanges, Is.EqualTo(new[] { new RateChangeEvent(85, 6m, 7.5m, 1_199.10m, 1_365.01m) }),
                "one reset, after seven years: the balance re-amortized at 7.5% over the 276 payments left");
            Assert.That(schedule.TotalInterest, Is.EqualTo(277_467.08m), "interest at 6% for seven years, then 7.5%");
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(360), "the term stays the same");
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero, "and it still ends at $0.00");
        });
    }

    [Test]
    public void TheCapsLimitHowFastTheRateMoves()
    {
        var schedule = Run(SevenOne(9m, 2m, 1m, 5m));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.RateChanges, Is.EqualTo(new[]
            {
                new RateChangeEvent(85, 6m, 8m, 1_199.10m, 1_422.49m),
                new RateChangeEvent(97, 8m, 9m, 1_422.49m, 1_537.18m),
            }), "up 2 points at the first reset, then 1 a year, until it reaches 9%");
            Assert.That(schedule.TotalInterest, Is.EqualTo(323_608.78m), "the interest that path charges");
        });
    }

    [Test]
    public void TheWorstCase_RisesAsFastAsTheCapsAllow_ToTheLifetimeCap()
    {
        var arm = SevenOne(7m, 2m, 2m, 5m).WorstCase(6m);
        var schedule = Run(arm);

        Assert.Multiple(() =>
        {
            Assert.That(arm.ExpectedRate, Is.EqualTo(11m), "the starting rate plus the lifetime cap");
            Assert.That(schedule.RateChanges.Select(c => (c.PaymentNumber, c.NewRate, c.NewPayment)), Is.EqualTo(new[]
            {
                (85, 8m, 1_422.49m), (97, 10m, 1_655.53m), (109, 11m, 1_774.09m),
            }), "8%, 10%, then 11%, where it stays");
            Assert.That(schedule.TotalInterest, Is.EqualTo(384_728.91m), "the most interest the caps allow");
        });
    }

    [Test]
    public void ARateCanFallToo_WithinTheSameCaps()
    {
        var schedule = Run(SevenOne(4m, 2m, 1m, 5m));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.RateChanges, Is.EqualTo(new[] { new RateChangeEvent(85, 6m, 4m, 1_199.10m, 994.55m) }), "down 2 points");
            Assert.That(schedule.TotalInterest, Is.EqualTo(175_220.37m), "less interest than at a fixed 6%");
        });
    }

    [Test]
    public void TheMargin_IsTheFloor_SoAFallingRateStopsThere()
    {
        // 6% falling toward 2% within 2/2/5 caps: 4%, then 2% without a floor, but 2.75% with a 2.75% margin.
        var unfloored = Run(SevenOne(2m, 2m, 2m, 5m));
        var floored = Run(SevenOne(2m, 2m, 2m, 5m) with { Margin = 2.75m });

        Assert.Multiple(() =>
        {
            Assert.That(unfloored.RateChanges.Select(c => (c.PaymentNumber, c.NewRate, c.NewPayment)), Is.EqualTo(new[] { (85, 4m, 994.55m), (97, 2m, 817.23m) }),
                "without a margin, the lifetime cap (1%) is the only floor");
            Assert.That(floored.RateChanges.Select(c => (c.PaymentNumber, c.NewRate, c.NewPayment)), Is.EqualTo(new[] { (85, 4m, 994.55m), (97, 2.75m, 881.34m) }),
                "with one, the rate stops at the margin");
            Assert.That(floored.TotalInterest, Is.EqualTo(145_332.19m), "the interest on that path");
        });
    }

    [Test]
    public void AMarginAboveTheStartingRate_FloorsAtTheStartingRate() =>
        Assert.That((SevenOne(3m, 2m, 2m, 5m) with { Margin = 7m }).RatePath(6m, 360), Is.Empty, "the rate can fall no lower than where it started");

    [Test]
    public void TheWorstCase_KeepsTheMargin() =>
        Assert.That((SevenOne(7m, 2m, 2m, 5m) with { Margin = 2.75m }).WorstCase(6m).Margin, Is.EqualTo(2.75m), "the floor is part of the loan");

    [Test]
    public void AnUnusableMargin_IsRejected() =>
        DomainAssert.Rejects(() => SevenOne(7m, 2m, 2m, 5m) with { Margin = -1m }, "margin", "the guard names the problem");

    [Test]
    public void TheRateNeverPassesTheLifetimeCapOrZero()
    {
        var up = SevenOne(30m, 10m, 10m, 3m).RatePath(6m, 360);
        var down = SevenOne(0m, 10m, 10m, 10m).RatePath(1m, 360);

        Assert.Multiple(() =>
        {
            Assert.That(up.Select(c => c.AnnualInterestRate), Is.EqualTo(new[] { 9m }), "the lifetime cap holds it at 9%");
            Assert.That(down.Select(c => c.AnnualInterestRate), Is.EqualTo(new[] { 0m }), "and it never goes below 0%");
        });
    }

    [Test]
    public void AResetThatChangesNothing_IsLeftOut() =>
        Assert.That(SevenOne(6m, 2m, 1m, 5m).RatePath(6m, 360), Is.Empty, "the expected rate is the starting rate: nothing changes");

    [Test]
    public void ExtraPayments_LowerThePaymentAtTheReset()
    {
        var loan = Fixed.WithAdjustableRate(SevenOne(7.5m, 5m, 2m, 5m));
        var schedule = _calculator.Generate(loan, new ExtraPaymentPlan([new MonthlyExtraPayment(200m)]), RecastPolicy.Never);

        Assert.That(schedule.RateChanges[0].NewPayment, Is.LessThan(1_365.01m),
            "the reset re-amortizes the smaller balance over the payments left, as lenders do");
    }

    [TestCase(0, 12, TestName = "No fixed period")]
    [TestCase(84, 0, TestName = "No reset interval")]
    public void AnUnusableArm_IsRejected(int fixedMonths, int interval) =>
        DomainAssert.Rejects(() => new AdjustableRate(fixedMonths, interval, 7m, 2m, 1m, 5m), "must", "the guard names the problem");

    [Test]
    public void RateChangesOutOfOrderOrOutsideTheTerm_AreRejected()
    {
        Assert.Multiple(() =>
        {
            DomainAssert.Rejects(() => Fixed.WithRateChanges([new RateChange(1, 7m)]), "after the first payment", "a change on payment 1 is just the rate");
            DomainAssert.Rejects(() => Fixed.WithRateChanges([new RateChange(361, 7m)]), "within the term", "past the last payment");
            DomainAssert.Rejects(() => Fixed.WithRateChanges([new RateChange(97, 7m), new RateChange(85, 8m)]), "in order", "out of order");
        });
    }
}
