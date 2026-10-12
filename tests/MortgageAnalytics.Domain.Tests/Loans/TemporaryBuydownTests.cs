using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

/// <summary>
/// A 2-1 buydown on a $356,250 loan at 5.99% over 30 years: paid as if at 3.99% in year 1 and 4.99% in year 2.
/// Every expected value comes from the independent model in tools/rate-check/rate_model.py.
/// </summary>
[TestFixture]
public class TemporaryBuydownTests
{
    private static readonly LoanTerms Loan = new(356_250m, 5.99m, 360, new DateOnly(2026, 11, 1));
    private static readonly TemporaryBuydown TwoOne = new([2m, 1m]);
    private const decimal NotePayment = 2_133.61m;

    [Test]
    public void EachYearIsPaidAtItsReducedRate_ThenAtTheNoteRate()
    {
        Assert.Multiple(() =>
        {
            Assert.That(TwoOne.RateForYear(Loan, 1), Is.EqualTo(3.99m), "year 1: two points off");
            Assert.That(TwoOne.RateForYear(Loan, 2), Is.EqualTo(4.99m), "year 2: one point off");
            Assert.That(TwoOne.RateForYear(Loan, 3), Is.EqualTo(5.99m), "then the note rate for the rest of the loan");
            Assert.That(TwoOne.PaymentForYear(Loan, 1), Is.EqualTo(1_698.74m), "the year-1 payment");
            Assert.That(TwoOne.PaymentForYear(Loan, 2), Is.EqualTo(1_910.25m), "the year-2 payment");
            Assert.That(TwoOne.PaymentForYear(Loan, 3), Is.EqualTo(NotePayment), "the note-rate payment from year 3");
        });
    }

    [Test]
    public void TheSubsidyCoversTheGap_ForTwoYears()
    {
        var total = Enumerable.Range(1, 360).Sum(p => TwoOne.SubsidyFor(Loan, p, NotePayment));

        Assert.Multiple(() =>
        {
            Assert.That(TwoOne.SubsidyFor(Loan, 1, NotePayment), Is.EqualTo(NotePayment - 1_698.74m), "each year-1 payment");
            Assert.That(TwoOne.SubsidyFor(Loan, 13, NotePayment), Is.EqualTo(NotePayment - 1_910.25m), "each year-2 payment");
            Assert.That(TwoOne.SubsidyFor(Loan, 25, NotePayment), Is.Zero, "nothing after the buydown years");
            Assert.That(total, Is.EqualTo(7_898.76m), "the buydown's cost: what the seller or builder pays up front");
            Assert.That(TwoOne.SubsidyFor(Loan, 12, 100m), Is.EqualTo(100m), "never more than a (final, small) payment itself");
        });
    }

    [Test]
    public void TheSubsidyOverASchedule_IsEveryBoughtDownPaymentsGap()
    {
        var schedule = new AmortizationCalculator().Generate(Loan, ExtraPaymentPlan.None, RecastPolicy.Never);

        Assert.That(TwoOne.TotalSubsidy(Loan, schedule), Is.EqualTo(7_898.76m), "24 payments, at $434.87 then $223.36 a month");
    }

    [Test]
    public void ALoanPaidOffDuringTheBuydown_NeedsLessSubsidy()
    {
        // A lump sum pays the loan off with payment 13: twelve year-1 gaps and one year-2 gap.
        var schedule = new AmortizationCalculator().Generate(Loan, new ExtraPaymentPlan([new LumpSumExtraPayment(1_000_000m, 13)]), RecastPolicy.Never);

        Assert.That(TwoOne.TotalSubsidy(Loan, schedule), Is.EqualTo(5_441.80m), "12 × $434.87 + $223.36: nothing is owed after that");
    }

    [Test]
    public void TheInterestYouPay_IsLessTheSubsidy_WhenTheSellerPaysForIt_AndAllOfIt_WhenYouDo()
    {
        var schedule = new AmortizationCalculator().Generate(Loan, ExtraPaymentPlan.None, RecastPolicy.Never);

        Assert.Multiple(() =>
        {
            Assert.That(schedule.TotalInterest, Is.EqualTo(411_848.49m), "the loan charges its note-rate interest either way");
            Assert.That(TwoOne.InterestYouPay(Loan, schedule, BuydownPayer.Seller), Is.EqualTo(403_949.73m),
                "the seller's subsidy pays $7,898.76 of the early payments, and the principal paid does not change, so it is interest");
            Assert.That(TwoOne.InterestYouPay(Loan, schedule, BuydownPayer.Borrower), Is.EqualTo(411_848.49m),
                "paid for at closing, the subsidy is your own money: lower early payments, the same interest");
        });
    }

    [Test]
    public void TheInterestYouPay_OnALoanPaidOffEarly_CountsOnlyTheSubsidyItUsed()
    {
        var schedule = new AmortizationCalculator().Generate(Loan, new ExtraPaymentPlan([new LumpSumExtraPayment(1_000_000m, 13)]), RecastPolicy.Never);

        Assert.That(TwoOne.InterestYouPay(Loan, schedule, BuydownPayer.Seller), Is.EqualTo(17_534.95m), "$22,976.75 of interest less $5,441.80");
    }

    [TestCase(new double[0], TestName = "No years")]
    [TestCase(new[] { 3.0, 2.0, 1.0, 0.5 }, TestName = "Four years")]
    [TestCase(new[] { 3.5 }, TestName = "More than three points")]
    [TestCase(new[] { 0.0 }, TestName = "No reduction")]
    public void AnUnusableBuydown_IsRejected(double[] reductions) =>
        DomainAssert.Rejects(() => new TemporaryBuydown(reductions.Select(r => (decimal)r).ToList()), "", "the guard rejects it");
}
