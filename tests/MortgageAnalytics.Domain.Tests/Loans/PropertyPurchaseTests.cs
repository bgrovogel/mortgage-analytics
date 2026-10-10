using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

[TestFixture]
public class PropertyPurchaseTests
{
    [TestCase(375_000, 75_000, 300_000, 20, 80)]
    [TestCase(250_000, 12_500, 237_500, 5, 95)]
    [TestCase(400_000, 0, 400_000, 0, 100)]
    [TestCase(333_333, 11_111, 322_222, 3.33, 96.67)]
    public void DerivesLoanAmountAndLoanToValueFromPriceAndDownPayment(
        decimal price, decimal down, decimal expectedLoan, decimal expectedDownPercent, decimal expectedLtv)
    {
        var purchase = new PropertyPurchase(price, down);

        Assert.Multiple(() =>
        {
            Assert.That(purchase.LoanAmount, Is.EqualTo(expectedLoan), "the loan is the price minus the down payment");
            Assert.That(purchase.DownPaymentPercent, Is.EqualTo(expectedDownPercent), "down payment as a percentage of the price");
            Assert.That(purchase.LoanToValuePercent, Is.EqualTo(expectedLtv), "loan-to-value is 100% minus the down-payment percentage");
        });
    }

    [TestCase(250_000, 50_000, false, TestName = "Exactly 20% down: no PMI")]
    [TestCase(250_000, 49_999.99, true, TestName = "One cent under 20% down: PMI required")]
    public void RequiresMortgageInsurance_OnlyWithLessThanTwentyPercentDown(decimal price, decimal down, bool expected)
    {
        var purchase = new PropertyPurchase(price, down);

        Assert.That(purchase.RequiresMortgageInsurance, Is.EqualTo(expected), "conventional loans need PMI only above 80% loan-to-value");
    }

    [TestCase(0, 0, "Home price", TestName = "Zero price")]
    [TestCase(300_000, -1, "cannot be negative", TestName = "Negative down payment")]
    [TestCase(300_000, 300_000, "less than the home price", TestName = "Down payment covers the whole price")]
    public void RejectsPurchasesThatLeaveNoValidLoan(decimal price, decimal down, string guard)
    {
        DomainAssert.Rejects(() => new PropertyPurchase(price, down), guard, "a purchase must leave a positive amount to borrow");
    }
}
