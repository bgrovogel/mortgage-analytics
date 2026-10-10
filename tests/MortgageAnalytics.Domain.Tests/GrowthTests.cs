namespace MortgageAnalytics.Domain.Tests;

[TestFixture]
public class GrowthTests
{
    [TestCase(2_400, 5, 0, 2_400.00, TestName = "Zero years leaves the amount unchanged")]
    [TestCase(2_400, 5, 1, 2_520.00, TestName = "One year of 5% growth")]
    [TestCase(2_400, 5, 2, 2_646.00, TestName = "Two years compound, not simple")]
    [TestCase(75, 3, 2, 79.57, TestName = "Result is rounded to cents")]
    [TestCase(1_000, -10, 2, 810.00, TestName = "Negative growth shrinks the amount")]
    [TestCase(1_000, 0, 30, 1_000.00, TestName = "Zero growth never changes the amount")]
    public void Compound_GrowsByThePercentageEachYear(decimal amount, decimal percent, int years, decimal expected)
    {
        var grown = Growth.Compound(amount, percent, years);

        Assert.That(grown, Is.EqualTo(expected), $"{amount:C} at {percent}% for {years} year(s) should compound to {expected:C}");
    }
}
