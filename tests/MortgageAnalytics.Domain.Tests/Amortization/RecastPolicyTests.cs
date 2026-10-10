using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Domain.Tests.Amortization;

[TestFixture]
public class RecastPolicyTests
{
    [TestCase(0)]
    [TestCase(50_000)]
    public void Never_NeverRecasts(decimal extraPrincipal)
    {
        Assert.That(RecastPolicy.Never.ShouldRecastAfter(extraPrincipal), Is.False, "the Never policy ignores every prepayment");
    }

    [TestCase(0, false, TestName = "No prepayment: nothing to recast")]
    [TestCase(9_999.99, false, TestName = "Below the minimum")]
    [TestCase(10_000, true, TestName = "Exactly the minimum")]
    [TestCase(25_000, true, TestName = "Above the minimum")]
    public void OnLumpSum_RecastsOnlyAtOrAboveTheMinimum(decimal extraPrincipal, bool expected)
    {
        var policy = RecastPolicy.OnLumpSum(10_000m, 250m);

        Assert.That(policy.ShouldRecastAfter(extraPrincipal), Is.EqualTo(expected), "the lender's minimum is inclusive");
    }

    [Test]
    public void OnLumpSum_ExposesTheLendersTerms()
    {
        var policy = RecastPolicy.OnLumpSum(10_000m, 250m);

        Assert.Multiple(() =>
        {
            Assert.That(policy.IsEnabled, Is.True, "an on-lump-sum policy recasts");
            Assert.That(policy.MinimumExtraPrincipal, Is.EqualTo(10_000m), "the lender minimum");
            Assert.That(policy.Fee, Is.EqualTo(250m), "the fee per recast");
        });
    }

    [Test]
    public void RejectsANegativeMinimum()
    {
        DomainAssert.Rejects(() => RecastPolicy.OnLumpSum(-1m, 0m), "minimum extra principal", "a negative minimum is meaningless");
    }

    [Test]
    public void RejectsANegativeFee()
    {
        DomainAssert.Rejects(() => RecastPolicy.OnLumpSum(0m, -1m), "fee cannot be negative", "a lender never pays the borrower to recast");
    }
}
