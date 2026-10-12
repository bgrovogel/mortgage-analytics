using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Amortization;

/// <summary>
/// The break-even shared by refinancing and discount points: the first payment by which the interest saved covers a
/// cost. Two one-year loans of $12,000, at 7% and 6%, make each month's saving small and easy to add up.
/// </summary>
[TestFixture]
public class InterestBreakEvenTests : AmortizationTestBase
{
    private static readonly DateOnly FirstPayment = new(2026, 11, 1);

    private AmortizationSchedule Dearer => StandardSchedule(new LoanTerms(12_000m, 7m, 12, FirstPayment));
    private AmortizationSchedule Cheaper => StandardSchedule(new LoanTerms(12_000m, 6m, 12, FirstPayment));

    /// <summary>The interest saved by the end of payment <paramref name="number"/>.</summary>
    private decimal SavedThrough(int number) =>
        Enumerable.Range(0, number).Sum(i => Dearer.Payments[i].Interest - Cheaper.Payments[i].Interest);

    [Test]
    public void ACostSavedExactly_BreaksEvenOnThatPayment()
    {
        Assert.That(InterestBreakEven.PaymentNumber(SavedThrough(5), Dearer, Cheaper), Is.EqualTo(5),
            "covering the cost exactly is breaking even, not a payment later");
    }

    [Test]
    public void ACostSavedOnlyByTheLastPayment_BreaksEvenOnIt()
    {
        Assert.That(InterestBreakEven.PaymentNumber(SavedThrough(12), Dearer, Cheaper), Is.EqualTo(12),
            "the last payment of both loans counts");
    }

    [Test]
    public void ACostNeverSaved_NeverBreaksEven()
    {
        Assert.That(InterestBreakEven.PaymentNumber(SavedThrough(12) + 0.01m, Dearer, Cheaper), Is.Null,
            "a cent more than the whole loan saves is never covered");
    }
}
