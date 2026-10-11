using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

/// <summary>
/// <see cref="LoanProgress"/> on the reference loan: $200,000 at 6% over 30 years, first payment 1 January 2026
/// (a $1,199.10 payment). The balance after ten payments, 197,963.60, was computed independently in Python
/// (Decimal, interest rounded half away from zero each month, as the schedule does).
/// </summary>
[TestFixture]
public class LoanProgressTests
{
    private static readonly LoanTerms Original = new(200_000m, 6m, 360, new DateOnly(2026, 1, 1));
    private readonly AmortizationCalculator _calculator = new();

    [TestCase("2026-01-01", 0, TestName = "The first payment is due today: none made yet")]
    [TestCase("2026-01-02", 1, TestName = "The day after the first payment: one made")]
    [TestCase("2026-10-09", 10, TestName = "January to October made")]
    [TestCase("2025-06-01", 0, TestName = "Before the loan starts")]
    [TestCase("2090-01-01", 360, TestName = "Long after the last payment: every one made")]
    public void PaymentsMadeBefore_CountsTheDueDatesBeforeToday(string today, int made) =>
        Assert.That(Original.PaymentsMadeBefore(DateOnly.Parse(today, System.Globalization.CultureInfo.InvariantCulture)), Is.EqualTo(made),
            "a payment counts as made once its due date has passed");

    [Test]
    public void RemainingAsOf_AnAdjustableRate_CarriesTodaysRateAndTheResetsStillAhead()
    {
        // Resets on payments 85 (to 7%) and 97 (to 8%). With 84 made, payment 85 is next: it is paid at 7%, and the
        // reset on 97 is the 13th payment of what is left.
        var arm = Original.WithRateChanges([new RateChange(85, 7m), new RateChange(97, 8m)]);

        var remaining = _calculator.RemainingAsOf(arm, new DateOnly(2032, 12, 2));

        Assert.Multiple(() =>
        {
            Assert.That(remaining.AnnualInterestRate, Is.EqualTo(7m), "the rate for the next payment, after the reset it falls on");
            Assert.That(remaining.RateChanges, Is.EqualTo(new[] { new RateChange(13, 8m) }),
                "only the reset still ahead, renumbered from the next payment");
        });
    }

    [Test]
    public void RemainingAsOf_IsWhatIsOwedOverThePaymentsLeft_FromTheNextDueDate()
    {
        var remaining = _calculator.RemainingAsOf(Original, new DateOnly(2026, 10, 9));

        Assert.Multiple(() =>
        {
            Assert.That(remaining.Principal, Is.EqualTo(197_963.60m), "the balance after ten scheduled payments");
            Assert.That(remaining.TermInMonths, Is.EqualTo(350), "the payments left");
            Assert.That(remaining.FirstPaymentDate, Is.EqualTo(new DateOnly(2026, 11, 1)), "the next due date");
            Assert.That(remaining.AnnualInterestRate, Is.EqualTo(6m), "the same rate");
            Assert.That(PaymentFormula.MonthlyPayment(remaining.Principal, remaining.MonthlyRate, remaining.TermInMonths), Is.EqualTo(1_199.10m),
                "the rest of the loan keeps the original payment");
        });
    }

    [Test]
    public void RemainingAsOf_BeforeTheFirstPayment_IsTheOriginalLoan() =>
        Assert.That(_calculator.RemainingAsOf(Original, new DateOnly(2025, 12, 15)), Is.SameAs(Original), "nothing has been paid yet");

    [Test]
    public void RemainingAsOf_AfterTheLastPayment_IsRejected() =>
        DomainAssert.Rejects(() => _calculator.RemainingAsOf(Original, new DateOnly(2056, 1, 2)), "already paid off",
            "a loan with no payments left cannot be refinanced");
}
