using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;
using Standard = MortgageAnalytics.Testing.ReferenceLoans.Standard;

namespace MortgageAnalytics.Domain.Tests.Amortization;

[TestFixture]
public class AmortizationCalculatorTests : AmortizationTestBase
{
    // ---------------------------------------------------------------------------------------
    // Invariants that must hold for every loan, whatever its shape.
    // ---------------------------------------------------------------------------------------

    private static IEnumerable<TestCaseData> LoanShapes()
    {
        yield return new TestCaseData(A.Loan()).SetName("30-year at 6%");
        yield return new TestCaseData(A.Loan(350_000m, 6.875m)).SetName("30-year at 6.875%");
        yield return new TestCaseData(A.Loan(250_000m, 7.5m, 180)).SetName("15-year at 7.5%");
        yield return new TestCaseData(A.Loan(100_000m, 0m, 120)).SetName("Zero-interest 10-year");
        yield return new TestCaseData(A.Loan(1m, 30m, 600)).SetName("One dollar at maximum rate and term");
        yield return new TestCaseData(A.Loan(100_000_000m, 30m, 600)).SetName("Maximum principal, rate and term");
        yield return new TestCaseData(A.Loan(999.99m, 3.333m, 7)).SetName("Odd amounts and a short term");
        yield return new TestCaseData(A.Loan(5_000m, 4m, 1)).SetName("Single-payment loan");
    }

    [TestCaseSource(nameof(LoanShapes))]
    public void Schedule_FullyRepaysThePrincipal_ToTheCent(LoanTerms loan)
    {
        var schedule = StandardSchedule(loan);

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero, "the final payment must clear the balance exactly");
            Assert.That(schedule.TotalPrincipal, Is.EqualTo(loan.Principal), "principal repaid must equal the amount borrowed");
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(loan.TermInMonths), "without extras the loan runs its full term");
        });
    }

    [TestCaseSource(nameof(LoanShapes))]
    public void Schedule_BalanceNeverIncreases_AndNeverGoesNegative(LoanTerms loan)
    {
        // Not "strictly decreases": on a $1 loan at 30% the 3-cent payment is all interest,
        // so the balance stays flat until the final payment clears it.
        var balances = StandardSchedule(loan).Payments.Select(p => p.RemainingBalance).Prepend(loan.Principal).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(balances, Is.Ordered.Descending, "a fully amortizing loan never grows");
            Assert.That(balances, Has.All.GreaterThanOrEqualTo(0m), "the loan can never be overpaid");
        });
    }

    [TestCaseSource(nameof(LoanShapes))]
    public void Schedule_EveryAmountIsRoundedToCents(LoanTerms loan)
    {
        var amounts = StandardSchedule(loan).Payments.SelectMany(p => new[] { p.Interest, p.Principal, p.RemainingBalance });

        Assert.That(amounts, Has.All.Matches<decimal>(a => a == Money.Round(a)), "no fractions of a cent may appear in a schedule");
    }

    [TestCaseSource(nameof(LoanShapes))]
    public void Schedule_EveryPaymentButTheLast_EqualsTheMonthlyPayment(LoanTerms loan)
    {
        var schedule = StandardSchedule(loan);

        Assert.That(
            schedule.Payments.SkipLast(1).Select(p => p.ScheduledAmount),
            Has.All.EqualTo(schedule.InitialMonthlyPayment),
            "only the final payment may differ, because it absorbs rounding drift");
    }

    // ---------------------------------------------------------------------------------------
    // Known values (cross-checked against an independent Python Decimal implementation).
    // ---------------------------------------------------------------------------------------

    [Test]
    public void InterestExactlyOnAHalfCent_RoundsUp_EvenWhenTheMonthlyRateRepeats()
    {
        // $6.00 at 7% accrues exactly 3.5 cents. 7% ÷ 12 is a repeating decimal, so multiplying by a
        // pre-divided monthly rate lands a hair under the half cent and wrongly rounds down.
        var schedule = StandardSchedule(A.Loan(6m, 7m, 1));

        Assert.That(schedule.Payments[0].Interest, Is.EqualTo(0.04m), "an exact half cent rounds up, away from zero");
    }

    [Test]
    public void FirstPayment_SplitsIntoInterestAndPrincipal()
    {
        var first = StandardSchedule(A.Loan()).Payments[0];

        Assert.Multiple(() =>
        {
            Assert.That(first.PaymentNumber, Is.EqualTo(1), "payments are numbered from 1");
            Assert.That(first.DueDate, Is.EqualTo(ReferenceLoans.FirstPaymentDate), "the first payment is due on the first payment date");
            Assert.That(first.Interest, Is.EqualTo(Standard.FirstInterest), "first month's interest is $200,000 x 0.5%");
            Assert.That(first.Principal, Is.EqualTo(Standard.FirstPrincipal), "the rest of the payment repays principal");
            Assert.That(first.RemainingBalance, Is.EqualTo(Standard.LoanAmount - Standard.FirstPrincipal), "the balance falls by the principal repaid");
        });
    }

    [TestCase(200_000, 6.0, 360, 231_677.04, 1_200.14)]
    [TestCase(350_000, 6.875, 360, 477_731.03, 2_300.28)]
    [TestCase(250_000, 7.5, 180, 167_155.68, 2_317.81)]
    [TestCase(1_000, 12.0, 12, 66.19, 88.84)]
    public void TotalInterest_AndFinalPayment_MatchReferenceValues(
        decimal principal, decimal rate, int months, decimal expectedInterest, decimal expectedFinalPayment)
    {
        var schedule = StandardSchedule(A.Loan(principal, rate, months));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.TotalInterest, Is.EqualTo(expectedInterest), "total interest must match the reference implementation");
            Assert.That(schedule.Payments[^1].ScheduledAmount, Is.EqualTo(expectedFinalPayment), "the final payment absorbs rounding drift");
            Assert.That(schedule.TotalPaid, Is.EqualTo(principal + expectedInterest), "total paid is principal plus interest");
        });
    }

    [Test]
    public void ZeroInterest_FinalPaymentAbsorbsRoundingDrift()
    {
        // 100,000 / 120 = 833.333... rounds to 833.33, leaving 0.40 for the last payment to pick up.
        var schedule = StandardSchedule(A.Loan(100_000m, 0m, 120));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.InitialMonthlyPayment, Is.EqualTo(833.33m), "at 0% the payment is principal / term, rounded");
            Assert.That(schedule.Payments[^1].ScheduledAmount, Is.EqualTo(833.73m), "the final payment picks up the 40 cents of drift");
            Assert.That(schedule.TotalInterest, Is.Zero, "a 0% loan charges no interest");
        });
    }

    // ---------------------------------------------------------------------------------------
    // Extra payments.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void MonthlyExtra_ShortensTheTermAndReducesInterest()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.Never, new MonthlyExtraPayment(ReferenceLoans.StandardWithMonthlyExtra200.MonthlyExtra));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(ReferenceLoans.StandardWithMonthlyExtra200.NumberOfPayments), "$200 a month pays the loan off in 252 payments");
            Assert.That(schedule.TotalInterest, Is.EqualTo(ReferenceLoans.StandardWithMonthlyExtra200.TotalInterest), "interest must match the reference implementation");
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero, "the loan still ends at exactly zero");
            Assert.That(schedule.TotalPrincipal, Is.EqualTo(Standard.LoanAmount), "extra principal never makes total principal exceed the loan");
        });
    }

    [Test]
    public void LumpSumLargerThanBalance_IsCappedAndPaysTheLoanOff()
    {
        var loan = A.Loan(10_000m, 5m, 60);

        var schedule = WithExtras(loan, RecastPolicy.Never, new LumpSumExtraPayment(1_000_000m, 3));

        var last = schedule.Payments[^1];
        Assert.Multiple(() =>
        {
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(3), "the oversized lump sum pays the loan off with payment 3");
            Assert.That(last.RemainingBalance, Is.Zero, "the balance ends at exactly zero, never negative");
            Assert.That(last.ExtraPrincipal, Is.LessThan(10_000m), "only the outstanding balance is collected");
            Assert.That(schedule.TotalPrincipal, Is.EqualTo(loan.Principal), "nothing beyond the loan amount is repaid");
        });
    }

    [Test]
    public void LumpSumScheduledAfterPayoff_IsIgnored()
    {
        var schedule = WithExtras(A.Loan(1_000m, 12m, 12), RecastPolicy.Never, new LumpSumExtraPayment(500m, 100));

        Assert.That(schedule.Payments.Sum(p => p.ExtraPrincipal), Is.Zero, "a lump sum after the last payment never happens");
    }

    [Test]
    public void AnnualExtra_IsAppliedOncePerYear()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.Never, new AnnualExtraPayment(2_400m, 12));

        var paymentsWithExtra = schedule.Payments.Where(p => p.ExtraPrincipal > 0).Select(p => p.PaymentNumber).ToList();
        Assert.Multiple(() =>
        {
            Assert.That(paymentsWithExtra.Take(3), Is.EqualTo(new[] { 12, 24, 36 }), "the annual extra lands every 12 payments");
            Assert.That(schedule.NumberOfPayments, Is.LessThan(Standard.TermInMonths), "annual extras shorten the loan");
        });
    }

    // ---------------------------------------------------------------------------------------
    // Recasting.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Recast_KeepsThePayoffDateAndLowersThePayment()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.OnLumpSum(RecastPolicy.TypicalMinimumLumpSum, 0m), new LumpSumExtraPayment(50_000m, 12));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(Standard.TermInMonths), "a recast keeps the original payoff date");
            Assert.That(schedule.Payments[10].ScheduledAmount, Is.EqualTo(Standard.MonthlyPayment), "before the lump sum the payment is unchanged");
            Assert.That(schedule.Payments[12].ScheduledAmount, Is.EqualTo(ReferenceLoans.StandardRecastAfter50KLumpSum.NewPayment), "after the recast the payment drops");
            Assert.That(schedule.TotalInterest, Is.EqualTo(ReferenceLoans.StandardRecastAfter50KLumpSum.TotalInterest), "interest must match the reference implementation");
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero, "the recast loan still ends at exactly zero");
        });
    }

    [Test]
    public void Recast_StillPaysOffEarlyWhenExtrasCoverTheWholeBalance()
    {
        var schedule = WithExtras(A.Loan(10_000m, 5m, 60), RecastPolicy.OnLumpSum(RecastPolicy.TypicalMinimumLumpSum, 0m), new LumpSumExtraPayment(20_000m, 1));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(1), "a lump sum covering the balance ends the loan at once");
            Assert.That(schedule.Payments[0].RemainingBalance, Is.Zero, "nothing is left to recast");
            Assert.That(schedule.Recasts, Is.Empty, "there is no balance left to re-amortize");
        });
    }

    [Test]
    public void Recast_RecordsTheEventWithOldAndNewPayment()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.OnLumpSum(10_000m, 250m), new LumpSumExtraPayment(50_000m, 12));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Recasts, Has.Count.EqualTo(1), "one qualifying lump sum means one recast");
            Assert.That(schedule.Recasts[0], Is.EqualTo(new RecastEvent(12, Standard.MonthlyPayment, 895.60m, 250m)), "the event records when, from, to and the fee");
            Assert.That(schedule.TotalRecastFees, Is.EqualTo(250m), "the fee is totalled on the schedule");
        });
    }

    [Test]
    public void Recast_IsSkippedWhenThePrepaymentIsBelowTheLendersMinimum()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.OnLumpSum(10_000m, 250m), new MonthlyExtraPayment(200m));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Recasts, Is.Empty, "$200 a month never reaches a $10,000 minimum");
            Assert.That(schedule.NumberOfPayments, Is.EqualTo(ReferenceLoans.StandardWithMonthlyExtra200.NumberOfPayments), "the extras shorten the term instead");
            Assert.That(schedule.TotalRecastFees, Is.Zero, "no recast means no fee");
        });
    }

    [TestCase(9_999.99, 0, TestName = "Lump sum one cent under the minimum: no recast")]
    [TestCase(10_000, 1, TestName = "Lump sum exactly at the minimum: recast")]
    public void Recast_RequiresASingleLumpSumOfAtLeastTheMinimum(decimal lumpSum, int expectedRecasts)
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.OnLumpSum(10_000m, 250m), new LumpSumExtraPayment(lumpSum, 12));

        Assert.That(schedule.Recasts, Has.Count.EqualTo(expectedRecasts), "the lender's minimum is inclusive");
    }

    [Test]
    public void Recast_OnlyTheQualifyingLumpSumTriggersIt_WhenMixedWithSmallExtras()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.OnLumpSum(10_000m, 300m), new MonthlyExtraPayment(100m), new LumpSumExtraPayment(25_000m, 24));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Recasts.Select(r => r.AfterPaymentNumber), Is.EqualTo(new[] { 24 }), "only the payment with the lump sum recasts");
            Assert.That(schedule.Payments[24].ScheduledAmount, Is.LessThan(schedule.Payments[22].ScheduledAmount), "the payment drops after the recast");
            Assert.That(schedule.Payments[^1].RemainingBalance, Is.Zero, "the loan still ends at exactly zero");
        });
    }

    [Test]
    public void Recast_IsNotTriggeredBySmallerPaymentsThatOnlyAddUpToTheMinimum()
    {
        // $200 monthly + $9,900 lump sum = $10,100 in one month, but no single payment reaches $10,000.
        var schedule = WithExtras(A.Loan(), RecastPolicy.OnLumpSum(10_000m, 250m), new MonthlyExtraPayment(200m), new LumpSumExtraPayment(9_900m, 12));

        Assert.That(schedule.Recasts, Is.Empty, "lenders recast after one qualifying payment, not a month's total");
    }

    [Test]
    public void Recast_TwoLumpSumsInOneMonth_EachBelowTheMinimum_DoNotQualify()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.OnLumpSum(10_000m, 250m), new LumpSumExtraPayment(6_000m, 12), new LumpSumExtraPayment(6_000m, 12));

        Assert.That(schedule.Recasts, Is.Empty, "two $6,000 payments are not one $10,000 payment");
    }

    [Test]
    public void Recast_AnAnnualExtraOfAtLeastTheMinimum_Qualifies()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.OnLumpSum(10_000m, 250m), new AnnualExtraPayment(10_000m, 12));

        Assert.That(schedule.Recasts.Select(r => r.AfterPaymentNumber).Take(2), Is.EqualTo(new[] { 12, 24 }), "a $10,000 yearly payment is a single qualifying payment each year");
    }

    [Test]
    public void Never_DoesNotRecastEvenForLargeLumpSums()
    {
        var schedule = WithExtras(A.Loan(), RecastPolicy.Never, new LumpSumExtraPayment(50_000m, 12));

        Assert.Multiple(() =>
        {
            Assert.That(schedule.Recasts, Is.Empty, "the Never policy never recasts");
            Assert.That(schedule.Payments[12].ScheduledAmount, Is.EqualTo(Standard.MonthlyPayment), "the payment stays the same");
            Assert.That(schedule.NumberOfPayments, Is.LessThan(Standard.TermInMonths), "the lump sum shortens the term instead");
        });
    }

    [Test]
    public void OpeningBalance_IsTheBalanceBeforeThePaymentWasApplied()
    {
        var payments = WithExtras(A.Loan(), RecastPolicy.Never, new LumpSumExtraPayment(5_000m, 2)).Payments;

        Assert.Multiple(() =>
        {
            Assert.That(payments[0].OpeningBalance, Is.EqualTo(Standard.LoanAmount), "payment 1 opens at the full loan amount");
            Assert.That(payments[1].OpeningBalance, Is.EqualTo(payments[0].RemainingBalance), "each payment opens where the last one closed");
            Assert.That(payments[2].OpeningBalance, Is.EqualTo(payments[1].RemainingBalance), "including after a lump sum");
        });
    }

    [Test]
    public void Schedule_WithoutPayments_IsRejected()
    {
        DomainAssert.Rejects(() => new AmortizationSchedule(100m, []), "at least one payment", "an empty schedule has no payoff date");
    }
}
