using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

[TestFixture]
public class LoanTermsTests
{
    private static readonly DateOnly FirstPayment = new(2026, 1, 1);

    [TestCase(0, 6, 360, "Principal", TestName = "Zero principal")]
    [TestCase(-1, 6, 360, "Principal", TestName = "Negative principal")]
    [TestCase(100_000_000.01, 6, 360, "Principal", TestName = "Principal above maximum")]
    [TestCase(200_000, -0.01, 360, "interest rate", TestName = "Negative rate")]
    [TestCase(200_000, 30.01, 360, "interest rate", TestName = "Rate above maximum")]
    [TestCase(200_000, 6, 0, "Term", TestName = "Zero term")]
    [TestCase(200_000, 6, 601, "Term", TestName = "Term above maximum")]
    public void Constructor_InvalidTerms_AreRejectedByTheMatchingGuard(decimal principal, decimal rate, int months, string guard)
    {
        DomainAssert.Rejects(
            () => new LoanTerms(principal, rate, months, FirstPayment),
            guard,
            $"the {guard} guard must reject an out-of-range value");
    }

    [TestCase(0.01, 6, 360, TestName = "Boundary: one-cent principal is allowed")]
    [TestCase(100_000_000, 6, 360, TestName = "Boundary: maximum principal is allowed")]
    [TestCase(200_000, 0, 360, TestName = "Boundary: zero rate is allowed")]
    [TestCase(200_000, 30, 360, TestName = "Boundary: maximum rate is allowed")]
    [TestCase(200_000, 6, 1, TestName = "Boundary: one-month term is allowed")]
    [TestCase(200_000, 6, 600, TestName = "Boundary: 50-year term is allowed")]
    public void Constructor_BoundaryValues_AreAccepted(decimal principal, decimal rate, int months)
    {
        DomainAssert.Accepts(() => new LoanTerms(principal, rate, months, FirstPayment), "boundary values are inside the supported range");
    }

    [Test]
    public void MonthlyRate_IsAnnualPercentageDividedByTwelve()
    {
        var loan = new LoanTerms(100_000m, 6m, 360, FirstPayment);

        Assert.That(loan.MonthlyRate, Is.EqualTo(0.005m), "6% a year is 0.5% a month, as a fraction");
    }

    [Test]
    public void DueDateOf_AdvancesOneMonthPerPayment_AndClampsToMonthEnd()
    {
        var loan = new LoanTerms(100_000m, 6m, 360, new DateOnly(2026, 1, 31));

        Assert.Multiple(() =>
        {
            Assert.That(loan.DueDateOf(1), Is.EqualTo(new DateOnly(2026, 1, 31)), "payment 1 is due on the first payment date");
            Assert.That(loan.DueDateOf(2), Is.EqualTo(new DateOnly(2026, 2, 28)), "a 31st due date falls on the last day of February");
            Assert.That(loan.DueDateOf(13), Is.EqualTo(new DateOnly(2027, 1, 31)), "payment 13 is exactly a year after payment 1");
        });
    }
}
