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
            Assert.That(purchase.LoanAmount, Is.EqualTo(expectedLoan));
            Assert.That(purchase.DownPaymentPercent, Is.EqualTo(expectedDownPercent));
            Assert.That(purchase.LoanToValuePercent, Is.EqualTo(expectedLtv));
        });
    }

    [TestCase(250_000, 50_000, false)]
    [TestCase(250_000, 49_999.99, true)]
    public void RequiresMortgageInsurance_WithLessThanTwentyPercentDown(decimal price, decimal down, bool expected)
    {
        Assert.That(new PropertyPurchase(price, down).RequiresMortgageInsurance, Is.EqualTo(expected));
    }

    [TestCase(0, 0, TestName = "Zero price")]
    [TestCase(300_000, -1, TestName = "Negative down payment")]
    [TestCase(300_000, 300_000, TestName = "Down payment covers the whole price")]
    public void RejectsPurchasesThatLeaveNoValidLoan(decimal price, decimal down)
    {
        Assert.Throws<DomainValidationException>(() => _ = new PropertyPurchase(price, down));
    }
}
