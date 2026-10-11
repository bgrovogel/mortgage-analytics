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

    [TestCase(new double[0], TestName = "No years")]
    [TestCase(new[] { 3.0, 2.0, 1.0, 0.5 }, TestName = "Four years")]
    [TestCase(new[] { 3.5 }, TestName = "More than three points")]
    [TestCase(new[] { 0.0 }, TestName = "No reduction")]
    public void AnUnusableBuydown_IsRejected(double[] reductions) =>
        DomainAssert.Rejects(() => new TemporaryBuydown(reductions.Select(r => (decimal)r).ToList()), "", "the guard rejects it");
}
