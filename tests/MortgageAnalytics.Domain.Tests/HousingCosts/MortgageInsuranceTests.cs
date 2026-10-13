using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;
using static MortgageAnalytics.Domain.Tests.HousingCosts.HousingCostTestData;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

[TestFixture]
public class MortgageInsuranceTests
{
    [Test]
    public void IsChargedOnTheOriginalLoanAmount()
    {
        // 0.5% of $237,500 / 12 = $98.958... which rounds to $98.96.
        var pmi = new MortgageInsurance(FivePercentDown.PmiRate, A.FivePercentDownPurchase);

        Assert.Multiple(() =>
        {
            Assert.That(pmi.IsRequired, Is.True, "5% down is below the 20% threshold");
            Assert.That(pmi.MonthlyPremium, Is.EqualTo(FivePercentDown.MonthlyPmi), "0.5% of the original loan, divided by 12");
            Assert.That(pmi.AmountFor(Period(1, FivePercentDown.LoanAmount)), Is.EqualTo(FivePercentDown.MonthlyPmi), "charged from the first payment");
            Assert.That(pmi.Category, Is.EqualTo(HousingCostCategory.MortgageInsurance), "reported as PMI");
        });
    }

    [TestCase(50_000, false, TestName = "Exactly 20% down: not required")]
    [TestCase(49_999.99, true, TestName = "Just under 20% down: required")]
    public void IsRequiredOnlyWithLessThanTwentyPercentDown(decimal downPayment, bool expected)
    {
        var purchase = new PropertyPurchase(250_000m, downPayment);

        var pmi = new MortgageInsurance(0.5m, purchase);

        Assert.Multiple(() =>
        {
            Assert.That(pmi.IsRequired, Is.EqualTo(expected), "PMI follows the purchase's 20% rule");
            Assert.That(pmi.AmountFor(Period(1, purchase.LoanAmount)) > 0, Is.EqualTo(expected), "and is charged only when required");
        });
    }

    [TestCase(MortgageInsuranceCancellation.Automatic, 195_000.01, 98.96, TestName = "Automatic: one cent above 78% still pays")]
    [TestCase(MortgageInsuranceCancellation.Automatic, 195_000.00, 0, TestName = "Automatic: at 78% PMI stops")]
    [TestCase(MortgageInsuranceCancellation.BorrowerRequested, 200_000.01, 98.96, TestName = "Requested: one cent above 80% still pays")]
    [TestCase(MortgageInsuranceCancellation.BorrowerRequested, 200_000.00, 0, TestName = "Requested: at 80% PMI stops")]
    public void StopsAtTheCancellationLoanToValue(MortgageInsuranceCancellation cancellation, decimal openingBalance, decimal expected)
    {
        // 78% of $250,000 is $195,000; 80% is $200,000.
        var pmi = new MortgageInsurance(0.5m, A.FivePercentDownPurchase, cancellation);

        Assert.That(pmi.AmountFor(Period(100, openingBalance)), Is.EqualTo(expected), "PMI ends exactly at the cancellation balance");
    }

    [TestCase(150_000, TestName = "Actual balance far below 78%")]
    [TestCase(195_000.01, TestName = "Actual balance just above 78%")]
    public void Automatic_FollowsTheOriginalSchedule_NotTheActualBalance(decimal actualBalance)
    {
        // The original schedule is still a cent above 78% of value, so PMI is still due,
        // however far extra payments have brought the actual balance down.
        var pmi = new MortgageInsurance(0.5m, A.FivePercentDownPurchase, MortgageInsuranceCancellation.Automatic);

        var charge = pmi.AmountFor(Period(100, openingBalance: actualBalance, scheduledOpeningBalance: 195_000.01m));

        Assert.That(charge, Is.EqualTo(98.96m), "the Homeowners Protection Act bases automatic termination on the initial amortization schedule");
    }

    [Test]
    public void BorrowerRequested_FollowsTheActualBalance()
    {
        // The actual balance is below 80% of value; the original schedule is not yet.
        var pmi = new MortgageInsurance(0.5m, A.FivePercentDownPurchase, MortgageInsuranceCancellation.BorrowerRequested);

        var charge = pmi.AmountFor(Period(100, openingBalance: 199_000m, scheduledOpeningBalance: 230_000m));

        Assert.That(charge, Is.Zero, "a borrower may request removal once actual payments bring the balance to 80%");
    }

    [TestCase(MortgageInsuranceCancellation.Automatic, 78)]
    [TestCase(MortgageInsuranceCancellation.BorrowerRequested, 80)]
    public void ReportsItsCancellationPoint(MortgageInsuranceCancellation cancellation, decimal expected)
    {
        var pmi = new MortgageInsurance(0.5m, A.FivePercentDownPurchase, cancellation);

        Assert.That(pmi.CancelAtLoanToValue, Is.EqualTo(expected), "automatic removal is at 78%, a borrower request at 80%");
    }

    [TestCase(MortgageInsuranceCancellation.Automatic, 360, 180, 98.96, TestName = "Midpoint: payment 180 of 360 still pays")]
    [TestCase(MortgageInsuranceCancellation.Automatic, 360, 181, 0, TestName = "Midpoint: from payment 181 of 360, none, whatever the balance")]
    [TestCase(MortgageInsuranceCancellation.BorrowerRequested, 360, 181, 0, TestName = "Midpoint: on request too")]
    [TestCase(MortgageInsuranceCancellation.Automatic, 359, 180, 98.96, TestName = "Midpoint: an odd term rounds up, payment 180 of 359 pays")]
    [TestCase(MortgageInsuranceCancellation.Automatic, 359, 181, 0, TestName = "Midpoint: an odd term rounds up, payment 181 of 359 does not")]
    public void EndsAtTheLoansMidpoint_EvenAboveTheCancellationBalance(MortgageInsuranceCancellation cancellation, int term, int paymentNumber, decimal expected)
    {
        // Both balances are still far above 80% of value, as at a high rate on a small down payment.
        var pmi = new MortgageInsurance(0.5m, A.FivePercentDownPurchase, cancellation, term);

        var charge = pmi.AmountFor(Period(paymentNumber, openingBalance: 230_000m, scheduledOpeningBalance: 230_000m));

        Assert.That(charge, Is.EqualTo(expected), "the Homeowners Protection Act ends PMI at the midpoint of the amortization period");
    }

    [Test]
    public void RejectsANegativeRate()
    {
        DomainAssert.Rejects(() => new MortgageInsurance(-0.1m, A.FivePercentDownPurchase), "cannot be negative", "a negative premium would pay the borrower");
    }
}
