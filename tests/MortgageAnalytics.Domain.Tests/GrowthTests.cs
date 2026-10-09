namespace MortgageAnalytics.Domain.Tests;

[TestFixture]
public class GrowthTests
{
    [TestCase(2_400, 5, 0, 2_400.00)]
    [TestCase(2_400, 5, 1, 2_520.00)]
    [TestCase(2_400, 5, 2, 2_646.00)]
    [TestCase(75, 3, 2, 79.57)]
    [TestCase(1_000, -10, 2, 810.00)]
    [TestCase(1_000, 0, 30, 1_000.00)]
    public void Compound_GrowsByThePercentageEachYear_RoundedToCents(decimal amount, decimal percent, int years, decimal expected)
    {
        Assert.That(Growth.Compound(amount, percent, years), Is.EqualTo(expected));
    }
}
