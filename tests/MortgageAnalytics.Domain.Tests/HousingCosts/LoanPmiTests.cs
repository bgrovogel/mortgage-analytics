using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

[TestFixture]
public class LoanPmiTests
{
    private static readonly DateOnly FirstPayment = new(2026, 11, 1);

    [Test]
    public void ANewLoanAbove80Percent_PaysTheRateOnTheLoan_UntilEitherTheBalanceReaches80PercentOrTheMidpoint()
    {
        // 0.5% of $285,000 / 12 = $118.75; 80% of $300,000 is $240,000; half of 360 payments is 180.
        var pmi = LoanPmi.ForNewLoan(285_000m, 300_000m, 0.5m, 360);

        Assert.Multiple(() =>
        {
            Assert.That(pmi.MonthlyPremium, Is.EqualTo(118.75m), "the yearly rate on the loan, a twelfth each month");
            Assert.That(pmi.RemovalBalance, Is.EqualTo(240_000m), "removed on request at 80% of the home's value");
            Assert.That(pmi.LastPayment, Is.EqualTo(180), "and by law at the loan's midpoint at the latest");
        });
    }

    [TestCase(240_000, TestName = "Exactly 80% of the value: no PMI")]
    [TestCase(200_000, TestName = "Well under 80% of the value: no PMI")]
    public void ANewLoanAtOrBelow80Percent_PaysNone(decimal loanAmount)
    {
        Assert.That(LoanPmi.ForNewLoan(loanAmount, 300_000m, 0.5m, 360), Is.EqualTo(LoanPmi.None), "PMI is required only above 80% loan-to-value");
    }

    [Test]
    public void ANewLoanWithoutAHomeValue_PaysNone()
    {
        Assert.That(LoanPmi.ForNewLoan(285_000m, 0m, 0.5m, 360), Is.EqualTo(LoanPmi.None), "without a value there is no loan-to-value to require it");
    }

    [Test]
    public void PmiAlreadyOnALoan_IsWhatTheStatementSays_UntilTheBalanceReaches80PercentOfTheHomesValue()
    {
        var pmi = LoanPmi.OnCurrentLoan(148.44m, 375_000m);

        Assert.Multiple(() =>
        {
            Assert.That(pmi.MonthlyPremium, Is.EqualTo(148.44m), "the premium paid now");
            Assert.That(pmi.RemovalBalance, Is.EqualTo(300_000m), "removable on request at 80% of the value");
            Assert.That(pmi.LastPayment, Is.EqualTo(int.MaxValue), "the loan's midpoint is not known from what is owed today");
            Assert.That(LoanPmi.OnCurrentLoan(0m, 375_000m), Is.EqualTo(LoanPmi.None), "no premium: no PMI");
        });
    }

    [TestCase(1, 240_000.01, 118.75, TestName = "A cent above the removal balance: charged")]
    [TestCase(1, 240_000.00, 0, TestName = "At the removal balance: not charged")]
    [TestCase(180, 260_000, 118.75, TestName = "The midpoint payment: charged")]
    [TestCase(181, 260_000, 0, TestName = "After the midpoint: not charged, whatever the balance")]
    public void ChargesWhileAboveTheRemovalBalance_AndNotAfterTheLastPayment(int paymentNumber, decimal openingBalance, decimal expected)
    {
        var pmi = LoanPmi.ForNewLoan(285_000m, 300_000m, 0.5m, 360);

        Assert.That(pmi.For(paymentNumber, openingBalance), Is.EqualTo(expected), "PMI follows the actual balance and the payment count");
    }

    [Test]
    public void OnASchedule_AddsUpEveryChargeAndSaysTheLastPaymentWithOne()
    {
        var schedule = new AmortizationCalculator().Generate(new LoanTerms(285_000m, 6m, 360, FirstPayment), ExtraPaymentPlan.None, RecastPolicy.Never);
        var pmi = LoanPmi.ForNewLoan(285_000m, 300_000m, 0.5m, 360);
        var expectedLast = schedule.Payments.Last(p => p.OpeningBalance > 240_000m).PaymentNumber;

        Assert.Multiple(() =>
        {
            Assert.That(pmi.LastPaymentOn(schedule), Is.EqualTo(expectedLast), "the last payment that opens above the removal balance");
            Assert.That(pmi.TotalOn(schedule), Is.EqualTo(expectedLast * 118.75m), "one premium for each payment until then");
            Assert.That(pmi.FirstOn(schedule), Is.EqualTo(118.75m), "the first payment carries it");
            Assert.That(LoanPmi.None.LastPaymentOn(schedule), Is.Null, "no PMI: no last payment");
            Assert.That(LoanPmi.None.TotalOn(schedule), Is.Zero, "and nothing paid");
        });
    }

    [Test]
    public void RejectsNegativeAmounts()
    {
        Assert.Multiple(() =>
        {
            DomainAssert.Rejects(() => LoanPmi.OnCurrentLoan(-1m, 300_000m), "cannot be negative", "a negative premium would pay the borrower");
            DomainAssert.Rejects(() => LoanPmi.ForNewLoan(285_000m, 300_000m, -0.1m, 360), "cannot be negative", "nor a negative rate");
        });
    }
}
