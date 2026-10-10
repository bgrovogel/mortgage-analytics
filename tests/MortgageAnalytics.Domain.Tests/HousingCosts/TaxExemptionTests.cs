using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

[TestFixture]
public class TaxExemptionTests
{
    [TestCase(300_000, 140_000, 0, 160_000, TestName = "Fixed amount: Texas school homestead")]
    [TestCase(300_000, 0, 20, 240_000, TestName = "Percentage: 20% local option")]
    [TestCase(300_000, 10_000, 20, 230_000, TestName = "Both: percentage first, then the amount")]
    [TestCase(100_000, 140_000, 0, 0, TestName = "Exemption larger than the value: nothing to tax")]
    public void TaxableValue_SubtractsTheExemption(decimal assessed, decimal amount, decimal percent, decimal expected)
    {
        var exemption = new TaxExemption(amount, percent);

        Assert.That(exemption.TaxableValue(assessed), Is.EqualTo(expected), "taxable value after the exemption, never negative");
    }

    [Test]
    public void None_TaxesTheFullValue()
    {
        Assert.That(TaxExemption.None.TaxableValue(250_000m), Is.EqualTo(250_000m), "no exemption means the whole value is taxed");
    }

    [Test]
    public void Plus_AddsToTheAmountAndKeepsThePercentage()
    {
        var stacked = new TaxExemption(amount: 3_000m, percent: 20m).Plus(10_000m);

        Assert.Multiple(() =>
        {
            Assert.That(stacked.Amount, Is.EqualTo(13_000m), "the extra dollars stack on the existing amount");
            Assert.That(stacked.Percent, Is.EqualTo(20m), "the percentage is unchanged");
        });
    }

    [Test]
    public void RejectsANegativeAmount()
    {
        DomainAssert.Rejects(() => new TaxExemption(amount: -1m), "amount cannot be negative", "an exemption cannot add value");
    }

    [TestCase(-1)]
    [TestCase(101)]
    public void RejectsAPercentageOutsideZeroToHundred(decimal percent)
    {
        DomainAssert.Rejects(() => new TaxExemption(percent: percent), "between 0 and 100", "a percentage of value must be a real share");
    }
}
