using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

[TestFixture]
public class LoanTermsTests
{
    private static readonly DateOnly FirstPayment = new(2026, 1, 1);

    [TestCase(0, 6, 360, TestName = "Zero principal")]
    [TestCase(-1, 6, 360, TestName = "Negative principal")]
    [TestCase(100_000_000.01, 6, 360, TestName = "Principal above maximum")]
    [TestCase(200_000, -0.01, 360, TestName = "Negative rate")]
    [TestCase(200_000, 30.01, 360, TestName = "Rate above maximum")]
    [TestCase(200_000, 6, 0, TestName = "Zero term")]
    [TestCase(200_000, 6, 601, TestName = "Term above maximum")]
    public void Constructor_InvalidTerms_Throws(decimal principal, decimal rate, int months)
    {
        Assert.Throws<DomainValidationException>(() => _ = new LoanTerms(principal, rate, months, FirstPayment));
    }

    [TestCase(0.01, 6, 360, TestName = "Boundary: one-cent principal is allowed")]
    [TestCase(100_000_000, 6, 360, TestName = "Boundary: maximum principal is allowed")]
    [TestCase(200_000, 0, 360, TestName = "Boundary: zero rate is allowed")]
    [TestCase(200_000, 30, 360, TestName = "Boundary: maximum rate is allowed")]
    [TestCase(200_000, 6, 1, TestName = "Boundary: one-month term is allowed")]
    [TestCase(200_000, 6, 600, TestName = "Boundary: 50-year term is allowed")]
    public void Constructor_BoundaryValues_AreAccepted(decimal principal, decimal rate, int months)
    {
        Assert.DoesNotThrow(() => _ = new LoanTerms(principal, rate, months, FirstPayment));
    }

    [Test]
    public void MonthlyRate_IsAnnualPercentageDividedByTwelve()
    {
        var loan = new LoanTerms(100_000m, 6m, 360, FirstPayment);

        Assert.That(loan.MonthlyRate, Is.EqualTo(0.005m));
    }

    [Test]
    public void DueDateOf_AdvancesOneMonthPerPayment_AndClampsToMonthEnd()
    {
        var loan = new LoanTerms(100_000m, 6m, 360, new DateOnly(2026, 1, 31));

        Assert.Multiple(() =>
        {
            Assert.That(loan.DueDateOf(1), Is.EqualTo(new DateOnly(2026, 1, 31)));
            Assert.That(loan.DueDateOf(2), Is.EqualTo(new DateOnly(2026, 2, 28)));
            Assert.That(loan.DueDateOf(13), Is.EqualTo(new DateOnly(2027, 1, 31)));
        });
    }
}
