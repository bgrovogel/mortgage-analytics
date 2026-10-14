using MortgageAnalytics.Domain.Affordability;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Affordability;

/// <summary>
/// Debt-to-income: the housing payment, and it with the other debts, as shares of gross monthly income, against the
/// limits lenders use. The household earns $150,000 a year ($12,500 a month) and pays $600 a month on other debts.
/// </summary>
[TestFixture]
public class DebtToIncomeTests
{
    private const decimal Income = 12_500m;
    private const decimal Debts = 600m;

    [Test]
    public void TheRatios_AreTheHousingPayment_AndItWithTheDebts_AsSharesOfIncome()
    {
        var ratios = new DebtToIncome(Income, Debts, 3_102.19m);

        Assert.Multiple(() =>
        {
            Assert.That(ratios.HousingPercent, Is.EqualTo(24.82m), "3,102.19 ÷ 12,500 = 24.8175%, to two decimals");
            Assert.That(ratios.TotalPercent, Is.EqualTo(29.62m), "3,702.19 ÷ 12,500 = 29.6175%");
        });
    }

    [Test]
    public void TheComfortableLimit_Is28PercentForHousing_And36WithEveryDebt()
    {
        var limit = DebtToIncomeLimit.Comfortable;

        Assert.Multiple(() =>
        {
            Assert.That((limit.HousingPercent, limit.TotalPercent), Is.EqualTo(((decimal?)28m, 36m)), "the classic 28/36");
            Assert.That(limit.MaxHousingPayment(Income, Debts), Is.EqualTo(3_500m), "28% is $3,500; 36% less the debts is $3,900, so the housing limit binds");
            Assert.That(limit.MaxHousingPayment(Income, 1_500m), Is.EqualTo(3_000m), "with $1,500 of debts, 36% leaves $3,000: now the total binds");
        });
    }

    [TestCase(LoanProgram.Conventional, null, 45, TestName = "Conventional: 45% in all (Fannie Mae B3-6-02), no housing limit")]
    [TestCase(LoanProgram.Fha, 31, 43, TestName = "FHA: 31% for housing, 43% in all")]
    [TestCase(LoanProgram.Va, null, 41, TestName = "VA: 41% in all, no housing limit")]
    public void TheMostAllowed_IsTheProgramsLimit(LoanProgram program, int? housing, int total)
    {
        var limit = DebtToIncomeLimit.MostAllowed(program);

        Assert.That((limit.HousingPercent, limit.TotalPercent), Is.EqualTo(((decimal?)housing, (decimal)total)), $"{program}'s limits");
    }

    [Test]
    public void WithNoHousingLimit_OnlyTheTotalBinds()
    {
        Assert.That(DebtToIncomeLimit.MostAllowed(LoanProgram.Conventional).MaxHousingPayment(Income, Debts), Is.EqualTo(5_025m), "45% is $5,625, less $600 of debts");
    }

    [Test]
    public void TheMostForHousing_IsRoundedDownToTheCent_AndNeverBelowZero()
    {
        var limit = DebtToIncomeLimit.Comfortable;

        Assert.Multiple(() =>
        {
            Assert.That(limit.MaxHousingPayment(3_333.33m, 0m), Is.EqualTo(933.33m), "28% of $3,333.33 is $933.3324");
            Assert.That(limit.MaxHousingPayment(Income, 5_000m), Is.Zero, "debts beyond 36% of income leave nothing for housing");
        });
    }

    [Test]
    public void AHome_FitsALimit_WhenItsPaymentIsWithinTheMost()
    {
        var limit = DebtToIncomeLimit.Comfortable;

        Assert.Multiple(() =>
        {
            Assert.That(limit.Allows(Income, Debts, 3_500m), Is.True, "exactly at the limit");
            Assert.That(limit.Allows(Income, Debts, 3_500.01m), Is.False, "a cent over it");
        });
    }
}
