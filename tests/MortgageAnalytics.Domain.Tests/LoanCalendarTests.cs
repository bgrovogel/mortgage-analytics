namespace MortgageAnalytics.Domain.Tests;

[TestFixture]
public class LoanCalendarTests
{
    [TestCase(1, 0)]
    [TestCase(12, 0)]
    [TestCase(13, 1)]
    [TestCase(360, 29)]
    public void YearOf_GroupsPaymentsIntoLoanYears(int paymentNumber, int expectedYear)
    {
        Assert.That(LoanCalendar.YearOf(paymentNumber), Is.EqualTo(expectedYear), "payments 1-12 are year 0, 13-24 year 1, and so on");
    }

    [TestCase(1, false)]
    [TestCase(11, false)]
    [TestCase(12, true)]
    [TestCase(24, true)]
    public void IsLastPaymentOfYear_IsEveryTwelfthPayment(int paymentNumber, bool expected)
    {
        Assert.That(LoanCalendar.IsLastPaymentOfYear(paymentNumber), Is.EqualTo(expected), "payment 12 closes year 1, payment 24 year 2");
    }
}
