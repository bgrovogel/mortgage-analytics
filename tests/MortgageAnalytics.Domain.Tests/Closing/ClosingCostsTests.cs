using MortgageAnalytics.Domain.Closing;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests.Closing;

/// <summary>
/// Cash to close, laid out as a Loan Estimate lays it out. The purchase is $375,000 with $18,750 down, so the loan is
/// $356,250 at 6.5%; its first year has $7,150 of property taxes and a $2,400 insurance premium. Expected values were
/// worked by hand and checked in Python <c>Decimal</c>. With 5% down on a conventional loan, the seller or builder may
/// pay up to 3% of the price, $11,250.
/// </summary>
[TestFixture]
public class ClosingCostsTests
{
    private static readonly PropertyPurchase Purchase = new(375_000m, 18_750m);
    private static readonly ClosingCosts Typical = new(loanCosts: 4_000m, otherFees: 1_000m, prepaidInterestDays: 15, escrowMonths: 3, sellerCredits: 3_000m);

    private static readonly LoanTerms Loan = new(356_250m, 6.5m, 360, new DateOnly(2026, 11, 1));

    private static CashToClose CashFor(
        ClosingCosts costs, decimal buydownCost = 0m, decimal discountPoints = 0m, decimal upfrontFee = 0m, decimal sellerBuydown = 0m,
        LoanProgram program = LoanProgram.Conventional) =>
        costs.CashToClose(Purchase, Loan, yearOneTaxes: 7_150m, yearOneInsurance: 2_400m, buydownCost, discountPoints, upfrontFee, sellerBuydown, program);

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
    public void AnUpfrontMortgageFeePaidInCash_IsAClosingCost()
    {
        var cash = CashFor(Typical, upfrontFee: 6_234.38m);

        Assert.Multiple(() =>
        {
            Assert.That(cash.UpfrontMortgageFee, Is.EqualTo(6_234.38m), "an FHA upfront MIP not added to the loan");
            Assert.That(cash.ClosingCosts, Is.EqualTo(16_973.47m), "is paid with the other closing costs");
        });
    }

    [Test]
    public void PrepaidInterest_IsOnTheWholeLoan_AFinancedFeeIncluded()
    {
        var cash = Typical.CashToClose(Purchase, new LoanTerms(362_484.38m, 6.5m, 360, new DateOnly(2026, 11, 1)), 7_150m, 2_400m);

        Assert.That(cash.DailyInterest, Is.EqualTo(64.55m), "interest accrues on everything borrowed: 362,484.38 × 6.5% ÷ 365");
    }

    [Test]
    public void Credits_PayOnlyClosingCosts_NeverTheDownPayment()
    {
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, prepaidInterestDays: 15, escrowMonths: 3, sellerCredits: 15_000m));

        Assert.Multiple(() =>
        {
            Assert.That(cash.Credits, Is.EqualTo(10_739.09m), "credits cover the closing costs and no more");
            Assert.That(cash.UnusedCredits, Is.EqualTo(4_260.91m), "the rest is lost, and said so, rather than taken off the down payment");
            Assert.That(cash.Total, Is.EqualTo(18_750m), "the buyer still brings the down payment");
            Assert.That(cash.ConcessionsOverLimit, Is.Zero, "the $10,739.09 used is within the $11,250 limit");
        });
    }

    [Test]
    public void SellerCredits_CountAgainstTheLimit()
    {
        var cash = CashFor(Typical);

        Assert.Multiple(() =>
        {
            Assert.That(cash.Limit, Is.EqualTo(ConcessionLimit.For(LoanProgram.Conventional, Purchase)), "the conventional loan's limit for 5% down");
            Assert.That(cash.SellerCredits, Is.EqualTo(3_000m), "the seller's credits are used");
            Assert.That(cash.Concessions, Is.EqualTo(3_000m), "and count toward the limit");
            Assert.That(cash.ConcessionsOverLimit, Is.Zero, "$3,000 of $11,250");
        });
    }

    [Test]
    public void LenderCredits_PayClosingCosts_ButAreNotTheSellers()
    {
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, 15, 3, sellerCredits: 3_000m, lenderCredits: 2_000m));

        Assert.Multiple(() =>
        {
            Assert.That(cash.LenderCredits, Is.EqualTo(2_000m), "the lender's credit is used");
            Assert.That(cash.Credits, Is.EqualTo(5_000m), "with the seller's");
            Assert.That(cash.Concessions, Is.EqualTo(3_000m), "only the seller's count toward the limit");
            Assert.That(cash.Total, Is.EqualTo(24_489.09m), "18,750 down + 10,739.09 − 5,000 in credits");
        });
    }

    [Test]
    public void LenderCredits_AreUsedFirst()
    {
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, 15, 3, sellerCredits: 3_000m, lenderCredits: 10_000m));

        Assert.Multiple(() =>
        {
            Assert.That(cash.SellerCredits, Is.EqualTo(739.09m), "the seller's pay what the lender's leave of the $10,739.09");
            Assert.That(cash.UnusedCredits, Is.EqualTo(2_260.91m), "the rest of the seller's go unused");
            Assert.That(cash.Concessions, Is.EqualTo(739.09m), "only what the seller pays counts");
        });
    }

    [Test]
    public void LenderCreditsBeyondTheCosts_AreUnused()
    {
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, 15, 3, sellerCredits: 0m, lenderCredits: 11_000m));

        Assert.Multiple(() =>
        {
            Assert.That(cash.LenderCredits, Is.EqualTo(10_739.09m), "the lender's credit pays all the closing costs");
            Assert.That(cash.UnusedCredits, Is.EqualTo(260.91m), "and no more");
        });
    }

    [Test]
    public void ASellersBuydown_CountsToo_AndCreditsOverTheLimitAreNotAllowed()
    {
        var cash = CashFor(Typical, sellerBuydown: 9_000m);

        Assert.Multiple(() =>
        {
            Assert.That(cash.SellerBuydown, Is.EqualTo(9_000m), "the seller's buydown is kept, though not in the cash to close");
            Assert.That(cash.Concessions, Is.EqualTo(12_000m), "a $9,000 buydown and $3,000 of credits");
            Assert.That(cash.ConcessionsOverLimit, Is.EqualTo(750m), "$750 more than the $11,250 limit");
            Assert.That(cash.SellerCredits, Is.EqualTo(2_250m), "the lender allows the credits only up to the limit");
            Assert.That(cash.Total, Is.EqualTo(27_239.09m), "18,750 down + 10,739.09 − 2,250 in credits");
        });
    }

    [Test]
    public void ASellersBuydownAloneOverTheLimit_IsSaid()
    {
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, 15, 3, sellerCredits: 0m), sellerBuydown: 12_000m);

        Assert.Multiple(() =>
        {
            Assert.That(cash.ConcessionsOverLimit, Is.EqualTo(750m), "$12,000 is $750 over the limit");
            Assert.That(cash.Credits, Is.Zero, "no credits to take back");
        });
    }

    [Test]
    public void CreditsBeyondTheCosts_AreUnused_AndThoseWithinOverTheLimit_AreNotAllowed()
    {
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, 15, 3, sellerCredits: 15_000m), sellerBuydown: 2_000m);

        Assert.Multiple(() =>
        {
            Assert.That(cash.UnusedCredits, Is.EqualTo(4_260.91m), "$15,000 is $4,260.91 more than the closing costs");
            Assert.That(cash.Concessions, Is.EqualTo(12_739.09m), "the $2,000 buydown and the $10,739.09 of credits the costs could take");
            Assert.That(cash.ConcessionsOverLimit, Is.EqualTo(1_489.09m), "over the $11,250 limit");
            Assert.That(cash.SellerCredits, Is.EqualTo(9_250m), "the limit less the buydown");
            Assert.That(cash.Total, Is.EqualTo(20_239.09m), "18,750 down + 10,739.09 − 9,250 in credits");
        });
    }

    [Test]
    public void Va_LeavesTheNormalClosingCostsOutOfTheLimit()
    {
        // 4% of $375,000 is $15,000. The fees and prepaid interest (5,951.60) are normal closing costs; the insurance and
        // escrow (4,787.49) count, with the buydown.
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, 15, 3, sellerCredits: 10_739.09m), sellerBuydown: 12_000m, program: LoanProgram.Va);

        Assert.Multiple(() =>
        {
            Assert.That(cash.Concessions, Is.EqualTo(16_787.49m), "the $12,000 buydown and $4,787.49 of prepaids");
            Assert.That(cash.ConcessionsOverLimit, Is.EqualTo(1_787.49m), "over the $15,000 limit");
            Assert.That(cash.SellerCredits, Is.EqualTo(8_951.60m), "the credits less what is over");
        });
    }

    [Test]
    public void Va_StillLetsTheSellerPayTheNormalClosingCosts_WhenTheBuydownAloneIsOverTheLimit()
    {
        var cash = CashFor(new ClosingCosts(4_000m, 1_000m, 15, 3, sellerCredits: 10_739.09m), sellerBuydown: 16_000m, program: LoanProgram.Va);

        Assert.Multiple(() =>
        {
            Assert.That(cash.ConcessionsOverLimit, Is.EqualTo(5_787.49m), "$16,000 and $4,787.49 of prepaids, over the $15,000 limit");
            Assert.That(cash.SellerCredits, Is.EqualTo(5_951.60m), "only the credits that count are cut: the fees and prepaid interest are still paid");
        });
    }

    [Test]
    public void Va_LeavesDiscountPointsOutOfTheLimit()
    {
        var cash = CashFor(
            new ClosingCosts(4_000m, 1_000m, 15, 3, sellerCredits: 14_301.59m), discountPoints: 3_562.50m, sellerBuydown: 12_000m,
            program: LoanProgram.Va);

        Assert.That(cash.ConcessionsOverLimit, Is.EqualTo(1_787.49m), "the seller paying the $3,562.50 of points as well changes nothing");
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

    [TestCase(-0.01, 0, 0, 0, 0, 0, "Loan costs", TestName = "Negative loan costs")]
    [TestCase(0, -0.01, 0, 0, 0, 0, "Other fees", TestName = "Negative other fees")]
    [TestCase(0, 0, -1, 0, 0, 0, "Prepaid interest", TestName = "Negative days of prepaid interest")]
    [TestCase(0, 0, 32, 0, 0, 0, "Prepaid interest", TestName = "More days of prepaid interest than a month has")]
    [TestCase(0, 0, 0, -1, 0, 0, "Escrow", TestName = "Negative months of escrow")]
    [TestCase(0, 0, 0, 15, 0, 0, "Escrow", TestName = "More escrow than a year and the two-month cushion")]
    [TestCase(0, 0, 0, 0, -0.01, 0, "Seller credits", TestName = "Negative seller credits")]
    [TestCase(0, 0, 0, 0, 0, -0.01, "Lender credits", TestName = "Negative lender credits")]
    public void RejectsCostsNoLoanEstimateCouldShow(decimal loanCosts, decimal otherFees, int days, int months, decimal seller, decimal lender, string guard)
    {
        DomainAssert.Rejects(() => new ClosingCosts(loanCosts, otherFees, days, months, seller, lender), guard, "each line of a Loan Estimate has its limits");
    }

    [Test]
    public void AcceptsTheLimitsThemselves()
    {
        DomainAssert.Accepts(
            () => new ClosingCosts(0m, 0m, ClosingCosts.MaxPrepaidInterestDays, ClosingCosts.MaxEscrowMonths, 0m),
            "31 days of interest and 14 months of escrow are the most a closing needs");
    }
}
