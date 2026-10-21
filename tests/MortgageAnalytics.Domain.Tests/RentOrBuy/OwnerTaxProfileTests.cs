using MortgageAnalytics.Domain.RentOrBuy;
using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Domain.Tests.RentOrBuy;

/// <summary>
/// What owning saves in tax over renting: the deduction the owner gets (mortgage interest, and property tax within the
/// limit on state and local taxes) against what the same person would deduct as a renter (the standard deduction, or
/// their other deductions when those are larger), at their tax rate. 2026 figures: a single filer's standard deduction
/// is $16,100, and state and local taxes are deductible up to $40,400. Every expected value is worked by hand.
/// </summary>
[TestFixture]
public class OwnerTaxProfileTests
{
    private static OwnerTaxProfile Single(decimal rate = 24m, decimal stateAndLocal = 0m, decimal other = 0m) =>
        new(FilingStatus.SingleFiler, rate, stateAndLocal, other);

    [Test]
    public void InterestAndPropertyTax_AboveTheStandardDeduction_SaveTaxOnTheExtra()
    {
        var saved = Single().TaxSavedByOwning(year: 1, deductibleInterest: 15_000m, propertyTax: 6_000m);

        Assert.That(saved, Is.EqualTo(1_176.00m), "(15,000 + 6,000) is 21,000, $4,900 over the $16,100 standard deduction, at 24%");
    }

    [Test]
    public void InterestAndPropertyTax_BelowTheStandardDeduction_SaveNothing()
    {
        var saved = Single().TaxSavedByOwning(1, 8_000m, 3_000m);

        Assert.That(saved, Is.EqualTo(0m), "11,000 does not beat the $16,100 a renter takes, so the home adds nothing");
    }

    [Test]
    public void OtherStateAndLocalTaxes_AreAnItemizedDeductionForTheRenterToo_ButOnlyWhenTheyBeatTheStandardOne()
    {
        var saved = Single(stateAndLocal: 12_000m).TaxSavedByOwning(1, 15_000m, 6_000m);

        Assert.That(saved, Is.EqualTo(4_056.00m), "owning: 12,000 + 6,000 + 15,000 = 33,000; renting: 12,000 is under the standard 16,100; so 16,900 more, at 24%");
    }

    [Test]
    public void TheLimitOnStateAndLocalTaxes_CapsWhatThePropertyTaxAdds()
    {
        var saved = Single(stateAndLocal: 38_000m).TaxSavedByOwning(1, 15_000m, 6_000m);

        Assert.That(saved, Is.EqualTo(4_176.00m), "owning: 38,000 + 6,000 is 44,000, capped at 40,400, plus 15,000 = 55,400; renting itemizes the 38,000; the 17,400 difference at 24%");
    }

    [Test]
    public void OtherItemizedDeductions_AreTheRentersToo_SoTheyDoNotCountAsTheHomes()
    {
        var saved = Single(other: 20_000m).TaxSavedByOwning(1, 15_000m, 6_000m);

        Assert.That(saved, Is.EqualTo(5_040.00m), "owning: 20,000 + 6,000 + 15,000 = 41,000; renting: 20,000 beats the 16,100; the 21,000 more at 24%");
    }

    [Test]
    public void AMarriedCouple_HaveALargerStandardDeduction_SoTheHomeHasToDoMore()
    {
        var couple = new OwnerTaxProfile(FilingStatus.MarriedFilingJointly, 24m, 0m, 0m);

        Assert.Multiple(() =>
        {
            Assert.That(couple.TaxSavedByOwning(1, 15_000m, 6_000m), Is.EqualTo(0m), "21,000 is under the $32,200 they take anyway");
            Assert.That(couple.TaxSavedByOwning(1, 30_000m, 8_000m), Is.EqualTo(1_392.00m), "38,000 is 5,800 over 32,200, at 24%");
        });
    }

    [Test]
    public void TheDeductionsRiseWithPrices_SoALaterYearNeedsMore()
    {
        var saved = Single().TaxSavedByOwning(year: 11, deductibleInterest: 20_000m, propertyTax: 6_000m);

        Assert.That(saved, Is.EqualTo(1_293.75m), "ten years at 2.5% make the standard deduction $20,609.36; 26,000 is 5,390.64 over it, at 24%");
    }

    [Test]
    public void ANoTaxRate_SavesNothing() =>
        Assert.That(Single(rate: 0m).TaxSavedByOwning(1, 30_000m, 6_000m), Is.EqualTo(0m), "a rate of nothing saves nothing");

    [TestCase(-1, 0, 0, TestName = "A tax rate below nothing")]
    [TestCase(50.01, 0, 0, TestName = "A tax rate past 50%")]
    [TestCase(24, -1, 0, TestName = "Other state and local taxes below nothing")]
    [TestCase(24, 0, -1, TestName = "Other deductions below nothing")]
    public void ProfilesThatCouldNotBeRealAreRefused(double rate, double stateAndLocal, double other) =>
        Assert.That(() => Single((decimal)rate, (decimal)stateAndLocal, (decimal)other).Validated(), Throws.TypeOf<DomainValidationException>(), "a tax profile is a rate and amounts a person could have");

    [Test]
    public void ARealisticProfile_IsAccepted() =>
        Assert.That(() => Single(37m, 20_000m, 5_000m).Validated(), Throws.Nothing, "ordinary figures");
}
