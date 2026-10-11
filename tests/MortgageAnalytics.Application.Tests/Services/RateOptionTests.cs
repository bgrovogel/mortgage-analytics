using MortgageAnalytics.Testing;
using static MortgageAnalytics.Testing.ReferenceLoans;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Temporary buydowns and adjustable rates through the real engine, on the reference loan ($200,000 at 6% over
/// 30 years). Every expected value comes from the independent model in tools/rate-check/rate_model.py.
/// </summary>
[TestFixture]
public class RateOptionTests : SociableAnalysisTestBase
{
    [Test]
    public void ABuydown_LowersWhatTheBorrowerPays_ForItsYears_WithoutChangingTheLoan()
    {
        var plain = Service.Analyze(A.Request);
        var response = Service.Analyze(A.Request.WithBuydown(2m, 1m));
        var buydown = response.Buydown!;

        Assert.Multiple(() =>
        {
            Assert.That(buydown.NoteRate, Is.EqualTo(6m), "the loan's own rate");
            Assert.That(buydown.Years.Select(y => (y.Year, y.AnnualInterestRate, y.MonthlyPayment)), Is.EqualTo(new[]
            {
                (1, 4m, 954.83m), (2, 5m, 1_073.64m), (3, 6m, Standard.MonthlyPayment),
            }), "paid as if at 4%, then 5%, then the note rate");
            Assert.That(buydown.TotalSubsidy, Is.EqualTo(4_436.76m), "the buydown's cost");
            Assert.That(response.Baseline.Payments[0].BuydownSubsidy, Is.EqualTo(Standard.MonthlyPayment - 954.83m), "the subsidy in year 1");
            Assert.That(response.Baseline.Payments[0].TotalOutlay, Is.EqualTo(954.83m), "so the borrower pays the reduced payment");
            Assert.That(response.Baseline.Payments[24].BuydownSubsidy, Is.Zero, "and nothing is subsidized from year 3");
            Assert.That(response.Baseline.TotalInterest, Is.EqualTo(plain.Baseline.TotalInterest), "the loan itself is unchanged");
            Assert.That(response.AdjustableRate, Is.Null, "a fixed rate has no worst case");
        });
    }

    [Test]
    public void AnAdjustableRate_ResetsAndReAmortizes_AndShowsTheWorstCaseTheCapsAllow()
    {
        var response = Service.Analyze(A.Request.WithAdjustableRate(7.5m));
        var reset = response.Baseline.RateChanges.Single();
        var worst = response.AdjustableRate!;

        Assert.Multiple(() =>
        {
            Assert.That((reset.PaymentNumber, reset.NewRate, reset.PreviousPayment, reset.NewPayment), Is.EqualTo((85, 7.5m, 1_199.10m, 1_365.01m)),
                "after seven years, the balance re-amortized at 7.5%");
            Assert.That(reset.EffectiveDate, Is.EqualTo(new DateOnly(2033, 1, 1)), "the 85th payment's due date");
            Assert.That(response.Baseline.TotalInterest, Is.EqualTo(277_467.08m), "the interest on that path");
            Assert.That(response.Baseline.Payments[84].AnnualInterestRate, Is.EqualTo(7.5m), "each payment reports its rate");
            Assert.That(response.Baseline.Payments[83].AnnualInterestRate, Is.EqualTo(6m), "the last one before the reset");
            Assert.That(worst.WorstCaseRateChanges.Select(c => (c.PaymentNumber, c.NewRate)), Is.EqualTo(new[] { (85, 11m) }),
                "5/2/5 caps let the first reset go straight to the lifetime cap");
            Assert.That(worst.WorstCasePeakPayment, Is.EqualTo(1_787.42m), "the highest payment it could reach");
            Assert.That(worst.WorstCaseTotalInterest, Is.EqualTo(394_058.09m), "and the most interest");
            Assert.That(response.Buydown, Is.Null, "no buydown");
        });
    }

    [Test]
    public void ExtraPayments_OnAnAdjustableRate_LowerThePaymentAtTheReset()
    {
        var response = Service.Analyze(A.Request.WithAdjustableRate(7.5m).WithMonthlyExtra(200m));

        Assert.That(response.Accelerated.RateChanges.Single().NewPayment, Is.LessThan(1_365.01m),
            "the smaller balance re-amortizes to a smaller payment");
    }

    [Test]
    public void AnArmsMargin_ReachesTheEngine()
    {
        var request = A.Request.WithAdjustableRate(2m, initialCap: 2m, periodicCap: 2m).Build();
        var response = Service.Analyze(request with { AdjustableRate = request.AdjustableRate! with { Margin = 2.75m } });

        Assert.That(response.Baseline.RateChanges.Select(c => c.NewRate), Is.EqualTo(new[] { 4m, 2.75m }), "the rate stops at the 2.75% margin");
    }
}
