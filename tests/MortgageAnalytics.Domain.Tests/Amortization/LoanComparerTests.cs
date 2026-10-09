using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Amortization;

[TestFixture]
public class LoanComparerTests
{
    private static readonly LoanTerms Loan = new(200_000m, 6m, 360, new DateOnly(2026, 1, 1));
    private readonly LoanComparer _comparer = new(new AmortizationCalculator());

    private static ExtraPaymentPlan Monthly(decimal amount) => new([new MonthlyExtraPayment(amount)]);

    [Test]
    public void Compare_ReportsInterestAndPaymentsSaved()
    {
        var comparison = _comparer.Compare(Loan, Monthly(200m), RecastPolicy.Never, HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Baseline.NumberOfPayments, Is.EqualTo(360));
            Assert.That(comparison.Accelerated.NumberOfPayments, Is.EqualTo(252));
            Assert.That(comparison.PaymentsSaved, Is.EqualTo(108));
            Assert.That(comparison.InterestSaved, Is.EqualTo(231_677.04m - 151_876.18m));
            Assert.That(comparison.NetSavings, Is.EqualTo(comparison.InterestSaved));
            Assert.That(comparison.TotalExtraPrincipal, Is.GreaterThan(0m));
        });
    }

    [Test]
    public void Compare_WithoutExtraPayments_ReportsNoSavings()
    {
        var comparison = _comparer.Compare(Loan, ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Accelerated, Is.SameAs(comparison.Baseline));
            Assert.That(comparison.InterestSaved, Is.Zero);
            Assert.That(comparison.PaymentsSaved, Is.Zero);
            Assert.That(comparison.NetSavings, Is.Zero);
        });
    }

    [Test]
    public void Compare_CountsPmiEndingSoonerAsSavings()
    {
        var purchase = new PropertyPurchase(250_000m, 12_500m);
        var loan = new LoanTerms(purchase.LoanAmount, 6.5m, 360, new DateOnly(2026, 1, 1));
        var costs = new HousingCostPlan([new MortgageInsurance(0.5m, purchase)]);

        var comparison = _comparer.Compare(loan, Monthly(300m), RecastPolicy.Never, costs);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.MortgageInsuranceSaved, Is.EqualTo(13_359.60m - 6_828.24m));
            Assert.That(comparison.NetSavings, Is.EqualTo(comparison.InterestSaved + comparison.MortgageInsuranceSaved));
        });
    }

    [Test]
    public void Compare_DoesNotCountTaxesInsuranceOrDuesAsSavings()
    {
        // These continue after payoff, so a shorter loan does not avoid them.
        var costs = new HousingCostPlan(
        [
            new ValueBasedTax(HousingCostCategory.PropertyTax, 250_000m, 2.1m),
            new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m),
            new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m),
        ]);

        var comparison = _comparer.Compare(Loan, Monthly(200m), RecastPolicy.Never, costs);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.AcceleratedCosts.Totals.Total, Is.LessThan(comparison.BaselineCosts.Totals.Total));
            Assert.That(comparison.NetSavings, Is.EqualTo(comparison.InterestSaved));
        });
    }

    [Test]
    public void Compare_SubtractsRecastFeesFromNetSavings()
    {
        var plan = new ExtraPaymentPlan([new LumpSumExtraPayment(50_000m, 12)]);

        var comparison = _comparer.Compare(Loan, plan, RecastPolicy.OnLumpSum(10_000m, 250m), HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.RecastFees, Is.EqualTo(250m));
            Assert.That(comparison.NetSavings, Is.EqualTo(comparison.InterestSaved - 250m));
            Assert.That(comparison.PaymentsSaved, Is.Zero, "a recast keeps the payoff date");
        });
    }

    [Test]
    public void Compare_NeverRecastsTheBaseline()
    {
        var spy = new RecordingCalculator();
        var plan = Monthly(100m);
        var recast = RecastPolicy.OnLumpSum(10_000m, 250m);

        new LoanComparer(spy).Compare(Loan, plan, recast, HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(spy.Calls[0], Is.EqualTo((ExtraPaymentPlan.None, RecastPolicy.Never)));
            Assert.That(spy.Calls[1], Is.EqualTo((plan, recast)));
        });
    }

    /// <summary>A hand-rolled test double; no mocking library is needed for one interface method.</summary>
    private sealed class RecordingCalculator : IAmortizationCalculator
    {
        private readonly AmortizationCalculator _inner = new();

        public List<(ExtraPaymentPlan Plan, RecastPolicy Recast)> Calls { get; } = [];

        public AmortizationSchedule Generate(LoanTerms loan, ExtraPaymentPlan extraPayments, RecastPolicy recastPolicy)
        {
            Calls.Add((extraPayments, recastPolicy));
            return _inner.Generate(loan, extraPayments, recastPolicy);
        }
    }
}
