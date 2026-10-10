using MortgageAnalytics.Application.Contracts;
using Extra200 = MortgageAnalytics.Testing.ReferenceLoans.StandardWithMonthlyExtra200;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;
using Recast50K = MortgageAnalytics.Testing.ReferenceLoans.StandardRecastAfter50KLumpSum;
using Standard = MortgageAnalytics.Testing.ReferenceLoans.Standard;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>Sociable scenarios: a request in, the reference numbers out, through the real engine.</summary>
[TestFixture]
public class AnalysisScenarioTests : SociableAnalysisTestBase
{
    [Test]
    public void StandardLoan_ProducesTheReferenceSchedule_AndNoSavings()
    {
        var response = Service.Analyze(A.Request);

        Assert.Multiple(() =>
        {
            Assert.That(response.Baseline.MonthlyPayment, Is.EqualTo(Standard.MonthlyPayment), "$200,000 at 6% over 30 years");
            Assert.That(response.Baseline.TotalInterest, Is.EqualTo(Standard.TotalInterest), "interest must match the reference implementation");
            Assert.That(response.Baseline.Payments, Has.Count.EqualTo(Standard.TermInMonths), "one row per payment");
            Assert.That(response.Accelerated.Payments, Is.EqualTo(response.Baseline.Payments), "without extras both schedules are identical");
            Assert.That(response.Savings.NetSavings, Is.Zero, "nothing extra paid, nothing saved");
        });
    }

    [Test]
    public void MonthlyExtra_ReportsSavingsAndBothPayoffDates()
    {
        var savings = Service.Analyze(A.Request.WithMonthlyExtra(Extra200.MonthlyExtra)).Savings;

        Assert.Multiple(() =>
        {
            Assert.That(savings.PaymentsSaved, Is.EqualTo(Extra200.PaymentsSaved), "360 - 252 payments");
            Assert.That(savings.InterestSaved, Is.EqualTo(Extra200.InterestSaved), "interest avoided");
            Assert.That(savings.NetSavings, Is.EqualTo(Extra200.InterestSaved), "no PMI or fees, so net equals interest saved");
            Assert.That(savings.OriginalPayoffDate, Is.EqualTo(Standard.PayoffDate), "payment 360");
            Assert.That(savings.AcceleratedPayoffDate, Is.EqualTo(Extra200.PayoffDate), "payment 252");
        });
    }

    [Test]
    public void Recast_LowersThePaymentAfterAQualifyingLumpSum_AndChargesTheFee()
    {
        var response = Service.Analyze(A.Request.WithLumpSum(Recast50K.LumpSumPaymentNumber, Recast50K.LumpSum).WithRecast(10_000m, 250m));

        var recast = response.Accelerated.Recasts.Single();
        Assert.Multiple(() =>
        {
            Assert.That(recast.AfterPaymentNumber, Is.EqualTo(Recast50K.LumpSumPaymentNumber), "the recast follows the lump sum");
            Assert.That(recast.EffectiveDate, Is.EqualTo(new DateOnly(2027, 1, 1)), "the new payment starts with payment 13");
            Assert.That(recast.NewPayment, Is.EqualTo(Recast50K.NewPayment), "re-amortized over the remaining 348 months");
            Assert.That(response.Accelerated.NumberOfPayments, Is.EqualTo(Standard.TermInMonths), "a recast keeps the payoff date");
            Assert.That(response.Savings.RecastFees, Is.EqualTo(250m), "one recast at $250");
            Assert.That(response.Savings.NetSavings, Is.EqualTo(response.Savings.InterestSaved - 250m), "the fee reduces net savings");
        });
    }

    [Test]
    public void Recast_DefaultMinimumIsTenThousandDollars()
    {
        var request = A.Request
            .WithStrategy(ExtraPaymentStrategy.Recast)
            .WithLumpSum(12, 9_999.99m)
            .WithLumpSum(24, 10_000m);

        var recasts = Service.Analyze(request).Accelerated.Recasts;

        Assert.That(recasts.Select(r => r.AfterPaymentNumber), Is.EqualTo(new[] { 24 }), "only the $10,000 lump sum qualifies");
    }

    [Test]
    public void FirstMonthHousingCosts_AreBrokenDownByCategory()
    {
        var request = A.Request.FivePercentDown().WithHousingCosts(c => c
            .WithLocalTax(2.1m).WithMudTax(0.85m).WithPid(1_200m, 10)
            .WithInsurance(2_400m).WithHoa(75m).WithPmi(FivePercentDown.PmiRate));

        var baseline = Service.Analyze(request).Baseline;

        var costs = baseline.MonthlyHousingCosts;
        Assert.Multiple(() =>
        {
            Assert.That(costs.PropertyTax, Is.EqualTo(437.50m), "2.1% of $250,000 / 12");
            Assert.That(costs.MudTax, Is.EqualTo(177.08m), "0.85% of $250,000 / 12");
            Assert.That(costs.PidAssessment, Is.EqualTo(100m), "$1,200 / 12");
            Assert.That(costs.HomeownersInsurance, Is.EqualTo(200m), "$2,400 / 12");
            Assert.That(costs.MortgageInsurance, Is.EqualTo(FivePercentDown.MonthlyPmi), "0.5% of $237,500 / 12");
            Assert.That(costs.HoaDues, Is.EqualTo(75m), "flat dues");
            Assert.That(costs.Total, Is.EqualTo(1_088.54m), "the sum of every category");
            Assert.That(baseline.TotalMonthlyPayment, Is.EqualTo(baseline.MonthlyPayment + 1_088.54m), "the all-in payment adds costs to principal and interest");
            Assert.That(baseline.Payments[0].TotalOutlay, Is.EqualTo(baseline.TotalMonthlyPayment), "the first row agrees with the headline");
        });
    }

    [TestCase(119, 100, TestName = "Payment 120: the last PID installment")]
    [TestCase(120, 0, TestName = "Payment 121: the PID has been repaid")]
    public void PidAssessment_EndsAfterItsRemainingYears(int index, decimal expected)
    {
        var payments = Service.Analyze(A.Request.WithHousingCosts(c => c.WithPid(1_200m, remainingYears: 10))).Baseline.Payments;

        Assert.That(payments[index].HousingCosts, Is.EqualTo(expected), "a 10-year PID covers payments 1 to 120");
    }

    [Test]
    public void Pmi_ReportsBothEndDatesAndTheSaving()
    {
        var request = A.Request.FivePercentDown().WithMonthlyExtra(300m).WithHousingCosts(c => c.WithPmi(FivePercentDown.PmiRate));

        var response = Service.Analyze(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.Baseline.MortgageInsuranceEndDate, Is.EqualTo(new DateOnly(2037, 3, 1)), "payment 135");
            Assert.That(response.Accelerated.MortgageInsuranceEndDate, Is.EqualTo(new DateOnly(2031, 9, 1)), "payment 69");
            Assert.That(response.Savings.MortgageInsuranceSaved, Is.EqualTo(FivePercentDown.PmiTotal - FivePercentDown.PmiTotalWith300Extra), "PMI avoided");
            Assert.That(response.Savings.NetSavings, Is.EqualTo(response.Savings.InterestSaved + response.Savings.MortgageInsuranceSaved), "PMI saved counts toward net savings");
        });
    }

    [Test]
    public void Pmi_RequestedRemovalEndsSoonerThanAutomatic()
    {
        DateOnly? EndDate(MortgageAnalytics.Domain.HousingCosts.MortgageInsuranceCancellation cancellation) =>
            Service.Analyze(A.Request.FivePercentDown().WithHousingCosts(c => c.WithPmi(FivePercentDown.PmiRate, cancellation)))
                .Baseline.MortgageInsuranceEndDate;

        Assert.That(
            EndDate(MortgageAnalytics.Domain.HousingCosts.MortgageInsuranceCancellation.BorrowerRequested),
            Is.LessThan(EndDate(MortgageAnalytics.Domain.HousingCosts.MortgageInsuranceCancellation.Automatic)!.Value),
            "80% loan-to-value is reached before 78%");
    }
}
