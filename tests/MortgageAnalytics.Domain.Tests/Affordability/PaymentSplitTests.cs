using MortgageAnalytics.Domain.Affordability;

namespace MortgageAnalytics.Domain.Tests.Affordability;

/// <summary>
/// Sharing one monthly payment between buyers in proportion to what each earns: to the cent, and never a cent more or
/// less than the payment.
/// </summary>
[TestFixture]
public class PaymentSplitTests
{
    [Test]
    public void ByIncome_SharesThePaymentInProportion_ToTheCent()
    {
        var shares = PaymentSplit.ByIncome(3_000m, [90_000m, 60_000m]);

        Assert.That(shares, Is.EqualTo(new[] { 1_800m, 1_200m }), "60% and 40% of $3,000");
    }

    [Test]
    public void ByIncome_AlwaysAddsUpToThePayment_WhenTheCentsDoNotDivide()
    {
        var shares = PaymentSplit.ByIncome(100m, [1m, 1m, 1m]);

        Assert.Multiple(() =>
        {
            Assert.That(shares.Sum(), Is.EqualTo(100m), "no cent lost or made");
            Assert.That(shares, Is.EqualTo(new[] { 33.34m, 33.33m, 33.33m }), "the odd cent goes to the first buyer, the one with the largest remainder");
        });
    }

    [Test]
    public void ByIncome_GivesTheWholePayment_ToASingleBuyer()
    {
        Assert.That(PaymentSplit.ByIncome(3_102.19m, [150_000m]), Is.EqualTo(new[] { 3_102.19m }), "one buyer pays it all");
    }

    [Test]
    public void ByIncome_NeedsSomeIncome()
    {
        Assert.That(() => PaymentSplit.ByIncome(100m, [0m, 0m]), Throws.ArgumentException, "nothing to share by");
    }
}
