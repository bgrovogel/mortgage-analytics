using MortgageAnalytics.Domain.Affordability;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Affordability;

/// <summary>
/// The rate a lender qualifies a borrower at. A fixed rate is the note rate. An adjustable rate follows the program:
/// Fannie Mae's Selling Guide B3-6-04 for a conventional loan, HUD Handbook 4000.1 (Section 251 ARMs) for FHA. Every
/// ARM here starts at 6% on a 30-year loan.
/// </summary>
[TestFixture]
public class QualifyingRateTests
{
    private static AdjustableRate Arm(int fixedMonths, decimal expected = 9m, decimal initialCap = 2m, decimal periodicCap = 2m, decimal lifetimeCap = 5m) =>
        new(fixedMonths, 12, expected, initialCap, periodicCap, lifetimeCap);

    private static QualifyingRate Conventional(AdjustableRate? arm) => QualifyingRate.For(LoanProgram.Conventional, 6m, arm, 360, 91m);

    [Test]
    public void AFixedRate_IsQualifiedAtTheNoteRate()
    {
        Assert.That(Conventional(null), Is.EqualTo(new QualifyingRate(6m, QualifyingRateBasis.NoteRate)), "nothing to adjust");
    }

    [Test]
    public void AConventionalArmFixedThreeYearsOrLess_IsQualifiedAtTheMostItReachesInFiveYears()
    {
        Assert.Multiple(() =>
        {
            Assert.That(Conventional(Arm(36)), Is.EqualTo(new QualifyingRate(10m, QualifyingRateBasis.MostInFirstFiveYears)),
                "a 3/1 ARM: 8% at payment 37, 10% at 49; the reset at 61 is past five years");
            Assert.That(Conventional(Arm(12)), Is.EqualTo(new QualifyingRate(11m, QualifyingRateBasis.MostInFirstFiveYears)),
                "a 1-year ARM reaches its 11% lifetime cap within five years");
        });
    }

    [Test]
    public void AConventionalArmFixedFiveYears_IsQualifiedAtTheFirstResetsCap_OrTheFullyIndexedRate()
    {
        Assert.Multiple(() =>
        {
            Assert.That(Conventional(Arm(60, expected: 7.5m)), Is.EqualTo(new QualifyingRate(8m, QualifyingRateBasis.FirstResetOrFullyIndexed)),
                "6% plus the 2-point first cap, above the 7.5% fully indexed rate");
            Assert.That(Conventional(Arm(60, expected: 9m)), Is.EqualTo(new QualifyingRate(9m, QualifyingRateBasis.FirstResetOrFullyIndexed)),
                "the 9% fully indexed rate, above 8%");
            Assert.That(Conventional(Arm(60, initialCap: 5m, lifetimeCap: 4m)).Rate, Is.EqualTo(10m),
                "the first cap is held to the lifetime cap: 6% + 4");
        });
    }

    [Test]
    public void AConventionalArmFixedLongerThanFiveYears_IsQualifiedAtTheNoteRate()
    {
        Assert.That(Conventional(Arm(84)), Is.EqualTo(new QualifyingRate(6m, QualifyingRateBasis.NoteRate)), "a 7/1 ARM");
    }

    [Test]
    public void EachConventionalRule_EndsWhereItsFixedPeriodDoes()
    {
        Assert.Multiple(() =>
        {
            Assert.That(Conventional(Arm(37)).Basis, Is.EqualTo(QualifyingRateBasis.FirstResetOrFullyIndexed), "fixed a month past three years");
            Assert.That(Conventional(Arm(61)).Basis, Is.EqualTo(QualifyingRateBasis.NoteRate), "fixed a month past five years");
        });
    }

    [Test]
    public void AChangeAtPayment60_IsWithinTheFirstFiveYears()
    {
        // Fixed 11 months, then a point a year: 7% at payment 12, then 8, 9, 10, and 11% at payment 60.
        Assert.That(Conventional(Arm(11, initialCap: 1m, periodicCap: 1m)).Rate, Is.EqualTo(11m), "the change at payment 60 counts");
    }

    [Test]
    public void AnFhaArmFixedLongerThanAYear_IsQualifiedAtItsStartingRate()
    {
        Assert.That(QualifyingRate.For(LoanProgram.Fha, 6m, Arm(13), 360, 96.5m).Basis, Is.EqualTo(QualifyingRateBasis.NoteRate),
            "only a 1-year ARM is qualified a point up");
    }

    [Test]
    public void APointUp_StopsAtTheHighestRateALoanCanHave()
    {
        Assert.That(QualifyingRate.For(LoanProgram.Fha, 29.5m, Arm(12, expected: 29.5m), 360, 96.5m).Rate, Is.EqualTo(LoanTerms.MaxAnnualInterestRate),
            "30%, not 30.5%");
    }

    [Test]
    public void AnFhaOneYearArm_WithLessThanFivePercentDown_IsQualifiedAPointHigher()
    {
        Assert.Multiple(() =>
        {
            Assert.That(QualifyingRate.For(LoanProgram.Fha, 6m, Arm(12), 360, 96.5m), Is.EqualTo(new QualifyingRate(7m, QualifyingRateBasis.StartPlusOnePoint)),
                "3.5% down: a 96.5% loan");
            Assert.That(QualifyingRate.For(LoanProgram.Fha, 6m, Arm(12), 360, 94.99m), Is.EqualTo(new QualifyingRate(6m, QualifyingRateBasis.NoteRate)),
                "under 95%: the starting rate");
            Assert.That(QualifyingRate.For(LoanProgram.Fha, 6m, Arm(12), 360, 95m).Rate, Is.EqualTo(7m), "95% or more");
            Assert.That(QualifyingRate.For(LoanProgram.Fha, 6m, Arm(36), 360, 96.5m).Rate, Is.EqualTo(6m), "a 3-year ARM: the starting rate");
        });
    }

    [Test]
    public void AVaArm_IsQualifiedAtItsStartingRate()
    {
        Assert.That(QualifyingRate.For(LoanProgram.Va, 6m, Arm(12), 360, 100m), Is.EqualTo(new QualifyingRate(6m, QualifyingRateBasis.NoteRate)),
            "VA's own rule is not modelled");
    }
}
