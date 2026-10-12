using MortgageAnalytics.Domain.Closing;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Closing;

/// <summary>
/// Cash to close, laid out as a Loan Estimate lays it out. The purchase is $375,000 with $18,750 down, so the loan is
/// $356,250 at 6.5%; its first year has $7,150 of property taxes and a $2,400 insurance premium. Expected values were
/// worked by hand and checked in Python <c>Decimal</c>.
/// </summary>
[TestFixture]
public class ClosingCostsTests
{
    private static readonly PropertyPurchase Purchase = new(375_000m, 18_750m);
    private static readonly ClosingCosts Typical = new(loanCosts: 4_000m, otherFees: 1_000m, prepaidInterestDays: 15, escrowMonths: 3, credits: 3_000m);

    private static CashToClose CashFor(ClosingCosts costs, decimal buydownCost = 0m, decimal discountPoints = 0m) =>
        costs.CashToClose(Purchase, annualInterestRate: 6.5m, yearOneTaxes: 7_150m, yearOneInsurance: 2_400m, buydownCost, discountPoints);

    [Test]
    public void PrepaidInterest_IsTheDailyInterest_RoundedToCents_TimesTheDays()
    {
        var cash = CashFor(Typical);

        Assert.Multiple(() =>
        {
            // 356,250 × 6.5% ÷ 365 = 63.4417…, shown on the Loan Estimate as $63.44 per day.
            Assert.That(cash.DailyInterest, Is.EqualTo(63.44m), "a year's interest on the loan over 365 days, to the cent");
            Assert.That(cash.PrepaidInterest, Is.EqualTo(951.60m), "for the 15 days from closing to the end of the month");
        });
    }

    [Test]
    public void Prepaids_AreAYearOfInsurance_AndEscrowIsMonthsOfTaxesAndInsurance()
    {
        var cash = CashFor(Typical);

        Assert.Multiple(() =>
        {
            Assert.That(cash.HomeownersInsurance, Is.EqualTo(2_400m), "the first year's premium is paid at closing");
            Assert.That(cash.MonthlyEscrow, Is.EqualTo(795.83m), "a twelfth of a year's taxes and insurance, (7,150 + 2,400) ÷ 12, to the cent");
            Assert.That(cash.EscrowDeposit, Is.EqualTo(2_387.49m), "three months of it start the escrow account");
        });
    }

    [Test]
    public void CashToClose_IsTheDownPayment_PlusClosingCosts_LessCredits()
    {
        var cash = CashFor(Typical);

        Assert.Multiple(() =>
        {
            Assert.That(cash.ClosingCosts, Is.EqualTo(10_739.09m), "4,000 + 1,000 in fees, 951.60 + 2,400 prepaid and 2,387.49 into escrow");
            Assert.That(cash.Credits, Is.EqualTo(3_000m), "the credits are all used");
            Assert.That(cash.Total, Is.EqualTo(26_489.09m), "18,750 down + 10,739.09 − 3,000 in credits");
        });
    }

    [Test]
    public void ABuydownTheBuyerPaysFor_IsPaidAtClosing()
    {
        var cash = CashFor(Typical, buydownCost: 5_123.45m);

        Assert.Multiple(() =>
        {
            Assert.That(cash.BuydownCost, Is.EqualTo(5_123.45m), "the subsidy is deposited at closing");
            Assert.That(cash.ClosingCosts, Is.EqualTo(15_862.54m), "so it is a closing cost");
        });
    }

    [Test]
    public void DiscountPoints_ArePaidAtClosing()
    {
        var cash = CashFor(Typical, discountPoints: 3_562.50m);

        Assert.Multiple(() =>
        {
            Assert.That(cash.DiscountPoints, Is.EqualTo(3_562.50m), "one point on the $356,250 loan");
            Assert.That(cash.ClosingCosts, Is.EqualTo(14_301.59m), "on top of the other closing costs");
        });
    }

    [Test]
    public void Credits_PayOnlyClosingCosts_NeverTheDownPayment()
    {
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, prepaidInterestDays: 15, escrowMonths: 3, credits: 15_000m));

        Assert.Multiple(() =>
        {
            Assert.That(cash.Credits, Is.EqualTo(10_739.09m), "credits cover the closing costs and no more");
            Assert.That(cash.UnusedCredits, Is.EqualTo(4_260.91m), "the rest is lost, and said so, rather than taken off the down payment");
            Assert.That(cash.Total, Is.EqualTo(18_750m), "the buyer still brings the down payment");
        });
    }

    [Test]
    public void NoClosingCostsEntered_StillPaysTheYearOfInsurance()
    {
        var cash = CashFor(ClosingCosts.None);

        Assert.Multiple(() =>
        {
            Assert.That(cash.ClosingCosts, Is.EqualTo(2_400m), "no fees, no prepaid interest, no escrow: only the insurance premium");
            Assert.That(cash.Total, Is.EqualTo(21_150m), "the down payment and the premium");
        });
    }

    [TestCase(-0.01, 0, 0, 0, 0, "Loan costs", TestName = "Negative loan costs")]
    [TestCase(0, -0.01, 0, 0, 0, "Other fees", TestName = "Negative other fees")]
    [TestCase(0, 0, -1, 0, 0, "Prepaid interest", TestName = "Negative days of prepaid interest")]
    [TestCase(0, 0, 32, 0, 0, "Prepaid interest", TestName = "More days of prepaid interest than a month has")]
    [TestCase(0, 0, 0, -1, 0, "Escrow", TestName = "Negative months of escrow")]
    [TestCase(0, 0, 0, 15, 0, "Escrow", TestName = "More escrow than a year and the two-month cushion")]
    [TestCase(0, 0, 0, 0, -0.01, "Credits", TestName = "Negative credits")]
    public void RejectsCostsNoLoanEstimateCouldShow(decimal loanCosts, decimal otherFees, int days, int months, decimal credits, string guard)
    {
        DomainAssert.Rejects(() => new ClosingCosts(loanCosts, otherFees, days, months, credits), guard, "each line of a Loan Estimate has its limits");
    }

    [Test]
    public void AcceptsTheLimitsThemselves()
    {
        DomainAssert.Accepts(
            () => new ClosingCosts(0m, 0m, ClosingCosts.MaxPrepaidInterestDays, ClosingCosts.MaxEscrowMonths, 0m),
            "31 days of interest and 14 months of escrow are the most a closing needs");
    }
}
