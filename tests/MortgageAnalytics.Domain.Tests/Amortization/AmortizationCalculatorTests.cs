using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Amortization;

[TestFixture]
public class AmortizationCalculatorTests
{
    private static readonly DateOnly FirstPayment = new(2026, 1, 1);
    private readonly AmortizationCalculator _calculator = new();

    private static LoanTerms Loan(decimal principal, decimal rate, int months) => new(principal, rate, months, FirstPayment);

    private AmortizationSchedule Standard(LoanTerms loan) =>
        _calculator.Generate(loan, ExtraPaymentPlan.None, RecastPolicy.Never);

    private AmortizationSchedule WithExtras(LoanTerms loan, RecastPolicy recastPolicy, params IExtraPaymentRule[] rules) =>
        _calculator.Generate(loan, new ExtraPaymentPlan(rules), recastPolicy);

    // ---------------------------------------------------------------------------------------
    // Invariants that must hold for every loan, whatever its shape.
    // ---------------------------------------------------------------------------------------

    private static IEnumerable<TestCaseData> LoanShapes()
    {
        yield return new TestCaseData(Loan(200_000m, 6m, 360)).SetName("30-year at 6%");
        yield return new TestCaseData(Loan(350_000m, 6.875m, 360)).SetName("30-year at 6.875%");
        yield return new TestCaseData(Loan(250_000m, 7.5m, 180)).SetName("15-year at 7.5%");
        yield return new TestCaseData(Loan(100_000m, 0m, 120)).SetName("Zero-interest 10-year");
        yield return new TestCaseData(Loan(1m, 30m, 600)).SetName("One dollar at maximum rate and term");
        yield return new TestCaseData(Loan(100_000_000m, 30m, 600)).SetName("Maximum principal, rate and term");
        yield return new TestCaseData(Loan(999.99m, 3.333m, 7)).SetName("Odd amounts and a short term");
        yield return new TestCaseData(Loan(5_000m, 4m, 1)).SetName("Single-payment loan");
    }

    [TestCaseSource(nameof(LoanShapes))]
    public void Schedule_FullyRepaysThePrincipal_ToTheCent(LoanTerms loan)
    {
        var schedule = Standard(loan);

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero);
            Assert.That(schedule.TotalPrincipal, Is.EqualTo(loan.Principal));
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(loan.TermInMonths));
        });
    }

    [TestCaseSource(nameof(LoanShapes))]
    public void Schedule_BalanceNeverIncreases_AndNeverGoesNegative(LoanTerms loan)
    {
        // Not "strictly decreases": on a $1 loan at 30% the 3-cent payment is all interest,
        // so the balance stays flat until the final payment clears it.
        var balances = Standard(loan).Payments.Select(p => p.RemainingBalance).Prepend(loan.Principal).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(balances, Is.Ordered.Descending);
            Assert.That(balances, Has.All.GreaterThanOrEqualTo(0m));
        });
    }

    [TestCaseSource(nameof(LoanShapes))]
    public void Schedule_EveryAmountIsRoundedToCents(LoanTerms loan)
    {
        var amounts = Standard(loan).Payments.SelectMany(p => new[] { p.Interest, p.Principal, p.RemainingBalance });

        Assert.That(amounts, Has.All.Matches<decimal>(a => a == Money.Round(a)));
    }

    [TestCaseSource(nameof(LoanShapes))]
    public void Schedule_EveryPaymentButTheLast_EqualsTheMonthlyPayment(LoanTerms loan)
    {
        var schedule = Standard(loan);

        Assert.That(
            schedule.Payments.SkipLast(1).Select(p => p.ScheduledAmount),
            Has.All.EqualTo(schedule.InitialMonthlyPayment));
    }

    // ---------------------------------------------------------------------------------------
    // Known values (cross-checked against an independent Python Decimal implementation).
    // ---------------------------------------------------------------------------------------

    [Test]
    public void FirstPayment_SplitsIntoInterestAndPrincipal()
    {
        var first = Standard(Loan(200_000m, 6m, 360)).Payments[0];

        Assert.Multiple(() =>
        {
            Assert.That(first.PaymentNumber, Is.EqualTo(1));
            Assert.That(first.DueDate, Is.EqualTo(FirstPayment));
            Assert.That(first.Interest, Is.EqualTo(1_000.00m));
            Assert.That(first.Principal, Is.EqualTo(199.10m));
            Assert.That(first.RemainingBalance, Is.EqualTo(199_800.90m));
        });
    }

    [TestCase(200_000, 6.0, 360, 231_677.04, 1_200.14)]
    [TestCase(350_000, 6.875, 360, 477_731.03, 2_300.28)]
    [TestCase(250_000, 7.5, 180, 167_155.68, 2_317.81)]
    [TestCase(1_000, 12.0, 12, 66.19, 88.84)]
    public void TotalInterest_AndFinalPayment_MatchReferenceValues(
        decimal principal, decimal rate, int months, decimal expectedInterest, decimal expectedFinalPayment)
    {
        var schedule = Standard(Loan(principal, rate, months));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.TotalInterest, Is.EqualTo(expectedInterest));
            Assert.That(schedule.Payments[^1].ScheduledAmount, Is.EqualTo(expectedFinalPayment));
            Assert.That(schedule.TotalPaid, Is.EqualTo(principal + expectedInterest));
        });
    }

    [Test]
    public void ZeroInterest_FinalPaymentAbsorbsRoundingDrift()
    {
        // 100,000 / 120 = 833.333... rounds to 833.33, leaving 0.40 for the last payment to pick up.
        var schedule = Standard(Loan(100_000m, 0m, 120));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.InitialMonthlyPayment, Is.EqualTo(833.33m));
            Assert.That(schedule.Payments[^1].ScheduledAmount, Is.EqualTo(833.73m));
            Assert.That(schedule.TotalInterest, Is.Zero);
        });
    }

    // ---------------------------------------------------------------------------------------
    // Extra payments.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void MonthlyExtra_ShortensTheTermAndReducesInterest()
    {
        var schedule = WithExtras(Loan(200_000m, 6m, 360), RecastPolicy.Never, new MonthlyExtraPayment(200m));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(252));
            Assert.That(schedule.TotalInterest, Is.EqualTo(151_876.18m));
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero);
            Assert.That(schedule.TotalPrincipal, Is.EqualTo(200_000m));
        });
    }

    [Test]
    public void LumpSumLargerThanBalance_IsCappedAndPaysTheLoanOff()
    {
        var loan = Loan(10_000m, 5m, 60);

        var schedule = WithExtras(loan, RecastPolicy.Never, new LumpSumExtraPayment(1_000_000m, 3));

        var last = schedule.Payments[^1];
        Assert.Multiple(() =>
        {
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(3));
            Assert.That(last.RemainingBalance, Is.Zero);
            Assert.That(last.ExtraPrincipal, Is.LessThan(10_000m), "only the outstanding balance is collected");
            Assert.That(schedule.TotalPrincipal, Is.EqualTo(loan.Principal));
        });
    }

    [Test]
    public void LumpSumScheduledAfterPayoff_IsIgnored()
    {
        var schedule = WithExtras(Loan(1_000m, 12m, 12), RecastPolicy.Never, new LumpSumExtraPayment(500m, 100));

        Assert.That(schedule.Payments.Sum(p => p.ExtraPrincipal), Is.Zero);
    }

    [Test]
    public void AnnualExtra_IsAppliedOncePerYear()
    {
        var schedule = WithExtras(Loan(200_000m, 6m, 360), RecastPolicy.Never, new AnnualExtraPayment(2_400m, 12));

        var paymentsWithExtra = schedule.Payments.Where(p => p.ExtraPrincipal > 0).Select(p => p.PaymentNumber).ToList();
        Assert.Multiple(() =>
        {
            Assert.That(paymentsWithExtra.Take(3), Is.EqualTo(new[] { 12, 24, 36 }));
            Assert.That(schedule.NumberOfPayments, Is.LessThan(360));
        });
    }

    [Test]
    public void Recast_KeepsThePayoffDateAndLowersThePayment()
    {
        var loan = Loan(200_000m, 6m, 360);

        var schedule = WithExtras(loan, RecastPolicy.OnLumpSum(RecastPolicy.TypicalMinimumLumpSum, 0m), new LumpSumExtraPayment(50_000m, 12));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(360));
            Assert.That(schedule.Payments[10].ScheduledAmount, Is.EqualTo(1_199.10m), "before the lump sum");
            Assert.That(schedule.Payments[12].ScheduledAmount, Is.EqualTo(895.60m), "recast after the lump sum");
            Assert.That(schedule.TotalInterest, Is.EqualTo(176_056.85m));
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero);
        });
    }

    [Test]
    public void Recast_StillPaysOffEarlyWhenExtrasCoverTheWholeBalance()
    {
        var schedule = WithExtras(Loan(10_000m, 5m, 60), RecastPolicy.OnLumpSum(RecastPolicy.TypicalMinimumLumpSum, 0m), new LumpSumExtraPayment(20_000m, 1));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(1));
            Assert.That(schedule.Payments[0].RemainingBalance, Is.Zero);
        });
    }

    [Test]
    public void Recast_RecordsTheEventWithOldAndNewPayment()
    {
        var schedule = WithExtras(Loan(200_000m, 6m, 360), RecastPolicy.OnLumpSum(10_000m, 250m), new LumpSumExtraPayment(50_000m, 12));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Recasts, Has.Count.EqualTo(1));
            Assert.That(schedule.Recasts[0], Is.EqualTo(new RecastEvent(12, 1_199.10m, 895.60m, 250m)));
            Assert.That(schedule.TotalRecastFees, Is.EqualTo(250m));
        });
    }

    [Test]
    public void Recast_IsSkippedWhenThePrepaymentIsBelowTheLendersMinimum()
    {
        // $200 a month never reaches a $10,000 minimum, so the payment stays level and the term shortens.
        var schedule = WithExtras(Loan(200_000m, 6m, 360), RecastPolicy.OnLumpSum(10_000m, 250m), new MonthlyExtraPayment(200m));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Recasts, Is.Empty);
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(252));
            Assert.That(schedule.TotalRecastFees, Is.Zero);
        });
    }

    [Test]
    public void Recast_OnlyTheQualifyingLumpSumTriggersIt_WhenMixedWithSmallExtras()
    {
        var schedule = WithExtras(
            Loan(200_000m, 6m, 360),
            RecastPolicy.OnLumpSum(10_000m, 300m),
            new MonthlyExtraPayment(100m),
            new LumpSumExtraPayment(25_000m, 24));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Recasts.Select(r => r.AfterPaymentNumber), Is.EqualTo(new[] { 24 }));
            Assert.That(schedule.Payments[24].ScheduledAmount, Is.LessThan(schedule.Payments[22].ScheduledAmount));
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero);
        });
    }

    [TestCase(9_999.99, 0, TestName = "Lump sum one cent under the minimum: no recast")]
    [TestCase(10_000, 1, TestName = "Lump sum exactly at the minimum: recast")]
    public void Recast_RequiresASingleLumpSumOfAtLeastTheMinimum(decimal lumpSum, int expectedRecasts)
    {
        var schedule = WithExtras(Loan(200_000m, 6m, 360), RecastPolicy.OnLumpSum(10_000m, 250m), new LumpSumExtraPayment(lumpSum, 12));

        Assert.That(schedule.Recasts, Has.Count.EqualTo(expectedRecasts));
    }

    [Test]
    public void Never_DoesNotRecastEvenForLargeLumpSums()
    {
        var schedule = WithExtras(Loan(200_000m, 6m, 360), RecastPolicy.Never, new LumpSumExtraPayment(50_000m, 12));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Recasts, Is.Empty);
            Assert.That(schedule.Payments[12].ScheduledAmount, Is.EqualTo(1_199.10m));
            Assert.That(schedule.NumberOfPayments, Is.LessThan(360));
        });
    }

    [Test]
    public void OpeningBalance_IsTheBalanceBeforeThePaymentWasApplied()
    {
        var payments = WithExtras(Loan(200_000m, 6m, 360), RecastPolicy.Never, new LumpSumExtraPayment(5_000m, 2)).Payments;

        Assert.Multiple(() =>
        {
            Assert.That(payments[0].OpeningBalance, Is.EqualTo(200_000m));
            Assert.That(payments[1].OpeningBalance, Is.EqualTo(payments[0].RemainingBalance));
            Assert.That(payments[2].OpeningBalance, Is.EqualTo(payments[1].RemainingBalance));
        });
    }
}
