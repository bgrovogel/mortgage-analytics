using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Loans;

/// <summary>
/// What a home's use allows: Fannie Mae's Eligibility Matrix for the most a conventional loan may be (a one-unit
/// purchase), HUD and VA for living in the home, and Texas's homestead exemption for a principal residence.
/// </summary>
[TestFixture]
public class OccupancyTests
{
    [Test]
    public void APurchase_IsOfAHomeLivedIn_UnlessSaidOtherwise()
    {
        Assert.That(new PropertyPurchase(400_000m, 40_000m).Occupancy, Is.EqualTo(Occupancy.PrimaryResidence), "most buyers live in the home");
    }

    [TestCase(Occupancy.PrimaryResidence, false, 97)]
    [TestCase(Occupancy.PrimaryResidence, true, 95)]
    [TestCase(Occupancy.SecondHome, false, 90)]
    [TestCase(Occupancy.SecondHome, true, 90)]
    [TestCase(Occupancy.InvestmentProperty, false, 85)]
    [TestCase(Occupancy.InvestmentProperty, true, 85)]
    public void AConventionalLoan_IsLimitedByTheHomesUse(Occupancy occupancy, bool adjustable, decimal percent)
    {
        Assert.That(occupancy.MaxConventionalLoanToValuePercent(adjustable), Is.EqualTo(percent),
            "the Eligibility Matrix: a one-unit purchase, fixed or adjustable");
    }

    [TestCase(Occupancy.PrimaryResidence, true)]
    [TestCase(Occupancy.SecondHome, false)]
    [TestCase(Occupancy.InvestmentProperty, false)]
    public void FhaAndVa_AreOnlyForAHomeLivedIn_AndSoIsAHomestead(Occupancy occupancy, bool lived)
    {
        Assert.Multiple(() =>
        {
            Assert.That(occupancy.AllowsGovernmentLoan(), Is.EqualTo(lived), "FHA and VA insure and guarantee homes their borrowers live in");
            Assert.That(occupancy.AllowsHomestead(), Is.EqualTo(lived), "a homestead is the owner's principal residence");
        });
    }
}
