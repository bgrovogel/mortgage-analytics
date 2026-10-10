namespace MortgageAnalytics.Domain.Tests;

[TestFixture]
public class DecimalMathTests
{
    [TestCase(2, 0, 1)]
    [TestCase(2, 1, 2)]
    [TestCase(2, 10, 1024)]
    [TestCase(1.5, 3, 3.375)]
    public void Pow_ComputesExactDecimalPowers(decimal value, int exponent, decimal expected)
    {
        Assert.That(DecimalMath.Pow(value, exponent), Is.EqualTo(expected), $"{value}^{exponent} must be exact in decimal");
    }
}
