using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;
using Extra200 = MortgageAnalytics.Testing.ReferenceLoans.StandardWithMonthlyExtra200;

namespace MortgageAnalytics.Domain.Tests.Amortization;

/// <summary>
/// The comparer's own decisions, isolated with a substitute calculator (unit tests), plus
/// end-to-end comparisons through the real calculator (sociable tests).
/// </summary>
[TestFixture]
public class LoanComparerTests : AmortizationTestBase
{
    private static readonly LoanTerms Loan = A.Loan();

    private static ExtraPaymentPlan Monthly(decimal amount) => new([new MonthlyExtraPayment(amount)]);

    /// <summary>A calculator substitute that returns a real standard schedule for any input.</summary>
    private IAmortizationCalculator StubCalculator()
    {
        var calculator = Substitute.For<IAmortizationCalculator>();
        calculator.Generate(default!, default!, default!).ReturnsForAnyArgs(StandardSchedule(Loan));
        return calculator;
    }

    // ---------------------------------------------------------------------------------------
    // Unit: the calculator is substituted, so these test only what the comparer decides.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Compare_GeneratesTheBaselineWithoutExtrasAndNeverRecast()
    {
        var calculator = StubCalculator();
        var plan = Monthly(100m);
        var recast = RecastPolicy.OnLumpSum(10_000m, 250m);

        new LoanComparer(calculator).Compare(Loan, plan, recast, HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(
                () => calculator.Received(1).Generate(Loan, ExtraPaymentPlan.None, RecastPolicy.Never),
                Throws.Nothing,
                "the baseline must be the plain schedule: no extras and no recast");
            Assert.That(
                () => calculator.Received(1).Generate(Loan, plan, recast),
                Throws.Nothing,
                "the accelerated schedule uses the caller's extras and recast policy");
        });
    }

    [Test]
    public void Compare_WithoutExtras_CallsTheCalculatorOnce_AndReusesTheBaseline()
    {
        var calculator = StubCalculator();

        var comparison = new LoanComparer(calculator).Compare(Loan, ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(
                () => calculator.ReceivedWithAnyArgs(1).Generate(default!, default!, default!),
                Throws.Nothing,
                "with nothing to accelerate, a second calculation would be wasted work");
            Assert.That(comparison.Accelerated, Is.SameAs(comparison.Baseline), "both sides of the comparison are the same schedule");
            Assert.That(comparison.AcceleratedCosts, Is.SameAs(comparison.BaselineCosts), "and so are their housing costs");
        });
    }

    // ---------------------------------------------------------------------------------------
    // Sociable: real calculator, checking the savings figures end to end.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Compare_ReportsInterestAndPaymentsSaved()
    {
        var comparison = new LoanComparer(Calculator).Compare(Loan, Monthly(Extra200.MonthlyExtra), RecastPolicy.Never, HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.PaymentsSaved, Is.EqualTo(Extra200.PaymentsSaved), "360 - 252 payments");
            Assert.That(comparison.InterestSaved, Is.EqualTo(Extra200.InterestSaved), "baseline interest minus accelerated interest");
            Assert.That(comparison.NetSavings, Is.EqualTo(Extra200.InterestSaved), "with no PMI or fees, net savings is the interest saved");
            Assert.That(comparison.TotalExtraPrincipal, Is.GreaterThan(0m), "the extra principal paid is reported");
        });
    }

    [Test]
    public void Compare_WithoutExtraPayments_ReportsNoSavings()
    {
        var comparison = new LoanComparer(Calculator).Compare(Loan, ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.InterestSaved, Is.Zero, "no extras, no interest saved");
            Assert.That(comparison.PaymentsSaved, Is.Zero, "no extras, no payments saved");
            Assert.That(comparison.NetSavings, Is.Zero, "no extras, no savings at all");
        });
    }

    private LoanComparison CompareFivePercentDownWith300Extra(MortgageInsuranceCancellation cancellation)
    {
        var purchase = A.FivePercentDownPurchase;
        var loan = A.Loan(purchase.LoanAmount, ReferenceLoans.FivePercentDown.AnnualInterestRate);
        var costs = new HousingCostPlan([new MortgageInsurance(ReferenceLoans.FivePercentDown.PmiRate, purchase, cancellation)]);
        return new LoanComparer(Calculator).Compare(loan, Monthly(300m), RecastPolicy.Never, costs);
    }

    [Test]
    public void Compare_RequestedPmiRemoval_CountsPmiEndingSoonerAsSavings()
    {
        var comparison = CompareFivePercentDownWith300Extra(MortgageInsuranceCancellation.BorrowerRequested);

        Assert.Multiple(() =>
        {
            Assert.That(
                comparison.MortgageInsuranceSaved,
                Is.EqualTo(ReferenceLoans.FivePercentDown.BorrowerRequestedPmiTotal - ReferenceLoans.FivePercentDown.BorrowerRequestedPmiTotalWith300Extra),
                "PMI saved is baseline PMI minus accelerated PMI");
            Assert.That(
                comparison.NetSavings,
                Is.EqualTo(comparison.InterestSaved + comparison.MortgageInsuranceSaved),
                "PMI saved counts toward net savings");
        });
    }

    [Test]
    public void Compare_AutomaticPmiRemoval_SavesNoPmi()
    {
        var comparison = CompareFivePercentDownWith300Extra(MortgageInsuranceCancellation.Automatic);

        Assert.That(comparison.MortgageInsuranceSaved, Is.Zero, "automatic removal follows the original schedule, which extra payments do not change");
    }

    [Test]
    public void Compare_DoesNotCountTaxesInsuranceOrDuesAsSavings()
    {
        // These continue after payoff, so a shorter loan does not avoid them.
        var costs = new HousingCostPlan(
        [
            new ValueBasedTax(HousingCostCategory.LocalTax, new PropertyValuation(250_000m), 2.1m),
            new AnnualFixedCost(HousingCostCategory.HomeownersInsurance, 2_400m),
            new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m),
        ]);

        var comparison = new LoanComparer(Calculator).Compare(Loan, Monthly(200m), RecastPolicy.Never, costs);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.AcceleratedCosts.Totals.Total, Is.LessThan(comparison.BaselineCosts.Totals.Total),
                "fewer months of escrow are collected through the shorter loan");
            Assert.That(comparison.NetSavings, Is.EqualTo(comparison.InterestSaved),
                "but that is not a saving: the owner keeps paying taxes, insurance and dues after payoff");
        });
    }

    [Test]
    public void Compare_SubtractsRecastFeesFromNetSavings()
    {
        var plan = new ExtraPaymentPlan([new LumpSumExtraPayment(50_000m, 12)]);

        var comparison = new LoanComparer(Calculator).Compare(Loan, plan, RecastPolicy.OnLumpSum(10_000m, 250m), HousingCostPlan.None);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.RecastFees, Is.EqualTo(250m), "one recast at $250");
            Assert.That(comparison.NetSavings, Is.EqualTo(comparison.InterestSaved - 250m), "fees reduce the net benefit");
            Assert.That(comparison.PaymentsSaved, Is.Zero, "a recast keeps the payoff date");
        });
    }
}
