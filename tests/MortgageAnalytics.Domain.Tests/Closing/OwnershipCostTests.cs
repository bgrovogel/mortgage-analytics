using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Closing;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Closing;

/// <summary>
/// What a loan costs over the years it is kept: $356,250 at 5.99% for 30 years ($2,133.61 a month) with $75 of HOA
/// dues, and $20,000 to close. The balance after a year comes from the cent-rounded schedule, checked in Python.
/// </summary>
[TestFixture]
public class OwnershipCostTests
{
    private static readonly LoanTerms Loan = new(356_250m, 5.99m, 360, new DateOnly(2026, 11, 1));
    private static readonly LoanComparison Comparison = new LoanComparer(new AmortizationCalculator()).Compare(
        Loan, ExtraPaymentPlan.None, RecastPolicy.Never, new HousingCostPlan([new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m)]));

    private static OwnershipCost Over(int years, TemporaryBuydown? buydown = null) =>
        OwnershipCost.Over(years, 20_000m, Loan, Comparison.Baseline, Comparison.BaselineCosts, buydown);

    [Test]
    public void IsTheCashToClose_ThePayments_AndWhatIsStillOwed()
    {
        var cost = Over(1);

        Assert.Multiple(() =>
        {
            Assert.That(cost.Years, Is.EqualTo(1), "the years it is kept");
            Assert.That(cost.CashToClose, Is.EqualTo(20_000m), "brought to closing");
            Assert.That(cost.Payments, Is.EqualTo(26_503.32m), "12 × ($2,133.61 + $75)");
            Assert.That(cost.Balance, Is.EqualTo(351_867.03m), "owed after the twelfth payment, paid on selling or refinancing");
            Assert.That(cost.Total, Is.EqualTo(398_370.35m), "20,000 + 26,503.32 + 351,867.03");
        });
    }

    [Test]
    public void ABuydownsSubsidy_IsNotPaidByTheBuyer()
    {
        Assert.That(Over(1, new TemporaryBuydown([2m, 1m])).Payments, Is.EqualTo(21_284.88m), "12 × ($1,698.74 + $75): the year-1 payment at 3.99%");
    }

    [Test]
    public void KeptForTheWholeTerm_NothingIsOwed()
    {
        var cost = Over(40);

        Assert.Multiple(() =>
        {
            Assert.That(cost.Balance, Is.Zero, "paid off");
            Assert.That(cost.Payments, Is.EqualTo(Comparison.Baseline.TotalPaid + 360 * 75m), "every payment and every month's dues");
        });
    }
}
