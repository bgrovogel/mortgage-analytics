using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

/// <summary>Housing costs applied to real schedules. PMI timing values were cross-checked in Python.</summary>
[TestFixture]
public class HousingCostPlanTests
{
    // $250,000 home, 5% down: a $237,500 loan at 6.5% over 30 years.
    private static readonly PropertyPurchase Purchase = new(250_000m, 12_500m);
    private static readonly LoanTerms Loan = new(Purchase.LoanAmount, 6.5m, 360, new DateOnly(2026, 1, 1));
    private readonly AmortizationCalculator _calculator = new();

    private static HousingCostPlan PmiOnly(MortgageInsuranceCancellation cancellation = MortgageInsuranceCancellation.Automatic) =>
        new([new MortgageInsurance(0.5m, Purchase, cancellation)]);

    private AmortizationSchedule Schedule(decimal monthlyExtra = 0m) =>
        _calculator.Generate(
            Loan,
            monthlyExtra > 0 ? new ExtraPaymentPlan([new MonthlyExtraPayment(monthlyExtra)]) : ExtraPaymentPlan.None,
            RecastPolicy.Never);

    [Test]
    public void ApplyTo_ProducesOneBreakdownPerPayment()
    {
        var schedule = Schedule();

        var costs = PmiOnly().ApplyTo(schedule);

        Assert.That(costs.Periods, Has.Count.EqualTo(schedule.NumberOfPayments));
    }

    [Test]
    public void Pmi_StopsWhenTheBalanceReaches78Percent()
    {
        var costs = PmiOnly().ApplyTo(Schedule());

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.EqualTo(135));
            Assert.That(costs.Totals[HousingCostCategory.MortgageInsurance], Is.EqualTo(13_359.60m));
            Assert.That(costs.Periods[135][HousingCostCategory.MortgageInsurance], Is.Zero);
        });
    }

    [Test]
    public void Pmi_EndsSoonerWhenTheBorrowerRequestsRemovalAt80Percent()
    {
        var costs = PmiOnly(MortgageInsuranceCancellation.BorrowerRequested).ApplyTo(Schedule());

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.EqualTo(124));
            Assert.That(costs.Totals[HousingCostCategory.MortgageInsurance], Is.EqualTo(12_271.04m));
        });
    }

    [Test]
    public void Pmi_EndsSoonerWithExtraPayments()
    {
        var costs = PmiOnly().ApplyTo(Schedule(monthlyExtra: 300m));

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.EqualTo(69));
            Assert.That(costs.Totals[HousingCostCategory.MortgageInsurance], Is.EqualTo(6_828.24m));
        });
    }

    [Test]
    public void Pmi_IsNeverChargedWithTwentyPercentDown()
    {
        var purchase = new PropertyPurchase(250_000m, 50_000m);
        var loan = new LoanTerms(purchase.LoanAmount, 6.5m, 360, new DateOnly(2026, 1, 1));
        var plan = new HousingCostPlan([new MortgageInsurance(0.5m, purchase)]);

        var costs = plan.ApplyTo(_calculator.Generate(loan, ExtraPaymentPlan.None, RecastPolicy.Never));

        Assert.Multiple(() =>
        {
            Assert.That(costs.MortgageInsuranceLastPayment, Is.Null);
            Assert.That(costs.Totals.Total, Is.Zero);
        });
    }

    [Test]
    public void ByYear_SumsEachLoanYear_SoIncreasesShowYearOverYear()
    {
        var plan = new HousingCostPlan([new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m, annualIncreasePercent: 5m)]);

        var costs = plan.ApplyTo(Schedule());

        Assert.Multiple(() =>
        {
            Assert.That(costs.ByYear, Has.Count.EqualTo(30));
            Assert.That(costs.ByYear[0][HousingCostCategory.HomeownersInsurance], Is.EqualTo(2_400m));
            Assert.That(costs.ByYear[1][HousingCostCategory.HomeownersInsurance], Is.EqualTo(2_520m));
        });
    }

    [Test]
    public void ByYear_EndsWithAPartialYearWhenTheLoanPaysOffMidYear()
    {
        var plan = new HousingCostPlan([new MonthlyFixedCost(HousingCostCategory.HoaDues, 100m)]);

        var costs = plan.ApplyTo(Schedule(monthlyExtra: 300m));

        Assert.Multiple(() =>
        {
            Assert.That(costs.ByYear, Has.Count.EqualTo((int)Math.Ceiling(costs.Periods.Count / 12.0)));
            Assert.That(costs.ByYear.Sum(y => y.Total), Is.EqualTo(costs.Totals.Total));
        });
    }

    [Test]
    public void None_ChargesNothing()
    {
        var costs = HousingCostPlan.None.ApplyTo(Schedule());

        Assert.Multiple(() =>
        {
            Assert.That(HousingCostPlan.None.IsEmpty, Is.True);
            Assert.That(costs.Totals.Total, Is.Zero);
        });
    }
}
