using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

/// <summary>Housing costs applied to real schedules. PMI timing values come from <see cref="ReferenceLoans"/>.</summary>
[TestFixture]
public class HousingCostPlanTests : AmortizationTestBase
{
    private static HousingCostPlan PmiOnly(MortgageInsuranceCancellation cancellation = MortgageInsuranceCancellation.Automatic) =>
        new([new MortgageInsurance(FivePercentDown.PmiRate, A.FivePercentDownPurchase, cancellation)]);

    /// <summary>The <see cref="FivePercentDown"/> loan, optionally with a monthly extra payment.</summary>
    private AmortizationSchedule FivePercentDownSchedule(decimal monthlyExtra = 0m) =>
        Calculator.Generate(
            A.Loan(FivePercentDown.LoanAmount, FivePercentDown.AnnualInterestRate),
            monthlyExtra > 0 ? new ExtraPaymentPlan([new MonthlyExtraPayment(monthlyExtra)]) : ExtraPaymentPlan.None,
            RecastPolicy.Never);

    [Test]
    public void TheFirstMonth_IsTheFirstPaymentsCosts_WithoutASchedule()
    {
        var plan = new HousingCostPlan([
            new MortgageInsurance(FivePercentDown.PmiRate, A.FivePercentDownPurchase, MortgageInsuranceCancellation.Automatic),
            new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m),
            new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m),
        ]);

        var first = plan.FirstMonth(FivePercentDown.LoanAmount);
        var scheduled = plan.ApplyTo(FivePercentDownSchedule()).Periods[0];

        Assert.Multiple(() =>
        {
            Assert.That(first.Total, Is.EqualTo(scheduled.Total), "the same costs as the schedule's first payment");
            Assert.That(first[HousingCostCategory.MortgageInsurance], Is.EqualTo(scheduled[HousingCostCategory.MortgageInsurance]), "PMI included");
            Assert.That(first.Total, Is.EqualTo(FivePercentDown.MonthlyPmi + 75m + 200m), "PMI, dues and a twelfth of the insurance");
        });
    }

    [Test]
    public void ApplyTo_ProducesOneBreakdownPerPayment()
    {
        var schedule = FivePercentDownSchedule();

        var costs = PmiOnly().ApplyTo(schedule);

        Assert.That(costs.Periods, Has.Count.EqualTo(schedule.NumberOfPayments), "every payment gets exactly one cost breakdown");
    }

    [Test]
    public void Pmi_StopsWhenTheBalanceReaches78Percent()
    {
        var costs = PmiOnly().ApplyTo(FivePercentDownSchedule());

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.EqualTo(FivePercentDown.PmiLastPayment), "the last payment that opens above 78% of value");
            Assert.That(costs.Totals[HousingCostCategory.MortgageInsurance], Is.EqualTo(FivePercentDown.PmiTotal), "135 months of $98.96");
            Assert.That(costs.Periods[FivePercentDown.PmiLastPayment][HousingCostCategory.MortgageInsurance], Is.Zero, "and nothing the month after");
        });
    }

    [Test]
    public void Pmi_EndsSoonerWhenTheBorrowerRequestsRemovalAt80Percent()
    {
        var costs = PmiOnly(MortgageInsuranceCancellation.BorrowerRequested).ApplyTo(FivePercentDownSchedule());

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.EqualTo(FivePercentDown.BorrowerRequestedPmiLastPayment), "80% is reached before 78%");
            Assert.That(costs.Totals[HousingCostCategory.MortgageInsurance], Is.EqualTo(FivePercentDown.BorrowerRequestedPmiTotal), "fewer months of PMI");
        });
    }

    [Test]
    public void AutomaticPmi_IsNotShortenedByExtraPayments()
    {
        var original = FivePercentDownSchedule();

        var costs = PmiOnly().ApplyTo(FivePercentDownSchedule(monthlyExtra: 300m), original);

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.EqualTo(FivePercentDown.PmiLastPayment), "automatic removal follows the original schedule");
            Assert.That(costs.Totals[HousingCostCategory.MortgageInsurance], Is.EqualTo(FivePercentDown.PmiTotal), "so the same PMI is paid");
        });
    }

    [Test]
    public void RequestedPmi_EndsSoonerWithExtraPayments()
    {
        var original = FivePercentDownSchedule();

        var costs = PmiOnly(MortgageInsuranceCancellation.BorrowerRequested).ApplyTo(FivePercentDownSchedule(monthlyExtra: 300m), original);

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.EqualTo(FivePercentDown.BorrowerRequestedPmiLastPaymentWith300Extra), "extra principal reaches 80% sooner");
            Assert.That(costs.Totals[HousingCostCategory.MortgageInsurance], Is.EqualTo(FivePercentDown.BorrowerRequestedPmiTotalWith300Extra), "fewer months of PMI");
        });
    }

    [Test]
    public void ApplyTo_PaymentsBeyondTheOriginalSchedule_HaveNoScheduledBalance()
    {
        // A recast can never extend a loan, but the lookup must still be safe past the original term.
        var shortOriginal = StandardSchedule(A.Loan(FivePercentDown.LoanAmount, FivePercentDown.AnnualInterestRate, 12));

        var costs = PmiOnly().ApplyTo(FivePercentDownSchedule(), shortOriginal);

        Assert.That(costs.Periods[12][HousingCostCategory.MortgageInsurance], Is.Zero, "past the original schedule, its balance is zero, so automatic PMI has ended");
    }

    [Test]
    public void Pmi_IsNeverChargedWithTwentyPercentDown()
    {
        var purchase = new MortgageAnalytics.Domain.Loans.PropertyPurchase(250_000m, 50_000m);
        var plan = new HousingCostPlan([new MortgageInsurance(0.5m, purchase)]);

        var costs = plan.ApplyTo(StandardSchedule(A.Loan(purchase.LoanAmount, 6.5m)));

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.Null, "there is no last PMI payment when there is no PMI");
            Assert.That(costs.Totals.Total, Is.Zero, "no PMI is charged at all");
        });
    }

    [Test]
    public void ByYear_SumsEachLoanYear_SoIncreasesShowYearOverYear()
    {
        var plan = new HousingCostPlan([new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m, annualIncreasePercent: 5m)]);

        var costs = plan.ApplyTo(StandardSchedule(A.Loan()));

        Assert.Multiple(() =>
        {
            Assert.That(costs.ByYear, Has.Count.EqualTo(30), "a 30-year loan has 30 loan years");
            Assert.That(costs.ByYear[0][HousingCostCategory.HomeownersInsurance], Is.EqualTo(2_400m), "year 1 is the starting premium");
            Assert.That(costs.ByYear[1][HousingCostCategory.HomeownersInsurance], Is.EqualTo(2_520m), "year 2 is 5% higher");
        });
    }

    [Test]
    public void ByYear_EndsWithAPartialYearWhenTheLoanPaysOffMidYear()
    {
        var plan = new HousingCostPlan([new MonthlyFixedCost(HousingCostCategory.HoaDues, 100m)]);

        var costs = plan.ApplyTo(FivePercentDownSchedule(monthlyExtra: 300m));

        Assert.Multiple(() =>
        {
            Assert.That(costs.ByYear, Has.Count.EqualTo((costs.Periods.Count + 11) / 12), "a final partial year still gets a row");
            Assert.That(costs.ByYear.Sum(y => y.Total), Is.EqualTo(costs.Totals.Total), "the yearly rows add up to the lifetime total");
        });
    }

    [Test]
    public void None_ChargesNothing()
    {
        var costs = HousingCostPlan.None.ApplyTo(StandardSchedule(A.Loan()));

        Assert.Multiple(() =>
        {
            Assert.That(HousingCostPlan.None.IsEmpty, Is.True, "the None plan holds no costs");
            Assert.That(costs.Totals.Total, Is.Zero, "and charges nothing");
        });
    }

    [Test]
    public void With_AddsACost_AndLeavesThePlanItCameFromAlone()
    {
        var schedule = StandardSchedule(A.Loan());
        var dues = new HousingCostPlan([new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m)]);

        var withInsurance = dues.With(new MonthlyFixedCost(HousingCostCategory.MortgageInsurance, 100m));

        Assert.Multiple(() =>
        {
            Assert.That(withInsurance.ApplyTo(schedule).Periods[0].Total, Is.EqualTo(175m), "both costs are charged");
            Assert.That(dues.ApplyTo(schedule).Periods[0].Total, Is.EqualTo(75m), "the original plan is unchanged");
        });
    }

    [Test]
    public void Schedule_RejectsBreakdownsThatDoNotMatchThePayments()
    {
        var schedule = StandardSchedule(A.Loan(1_000m, 0m, 2));

        DomainAssert.Rejects(
            () => new HousingCostSchedule(schedule, [HousingCostBreakdown.Empty]),
            "exactly one cost breakdown per payment",
            "costs must line up one-to-one with payments");
    }
}
