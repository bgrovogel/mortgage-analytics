using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for cash to close: the closing costs priced from the loan and its first year of costs. The
/// purchase is <see cref="FivePercentDown"/>: $250,000 with $12,500 down, so $237,500 at 6.5%. Expected values were
/// worked by hand and checked in Python <c>Decimal</c>. With 5% down on a conventional loan, the seller may pay up to 3%
/// of the price, $7,500.
/// </summary>
[TestFixture]
public class ClosingCostScenarioTests : SociableAnalysisTestBase
{
    /// <summary>School 1%, county/city 1.1% and MUD 0.85% of $250,000 (no homestead): $7,375 a year, plus a $2,400 premium.</summary>
    private static AmortizationRequestBuilder TexasPurchase() =>
        A.Request.FivePercentDown().WithHousingCosts(c => c
            .WithSchoolTax(1.0m).WithLocalTax(1.1m).WithMudTax(0.85m)
            .WithInsurance(2_400m).WithPid(1_200m).WithHoa(50m).WithPmi(FivePercentDown.PmiRate));

    [Test]
    public void CashToClose_PricesEachLineFromTheLoanAndItsFirstYear()
    {
        var cash = Service.Analyze(TexasPurchase().WithClosingCosts(credits: 3_000m)).CashToClose!;

        Assert.Multiple(() =>
        {
            Assert.That(cash.DownPayment, Is.EqualTo(FivePercentDown.DownPayment), "the down payment comes first");
            Assert.That(cash.DailyInterest, Is.EqualTo(42.29m), "237,500 × 6.5% ÷ 365 = 42.2945…");
            Assert.That(cash.PrepaidInterest, Is.EqualTo(634.35m), "for 15 days");
            Assert.That(cash.HomeownersInsurance, Is.EqualTo(2_400m), "the first year's premium");
            Assert.That(cash.MonthlyEscrow, Is.EqualTo(814.58m), "(7,375 of taxes + 2,400) ÷ 12; PID, HOA dues and PMI are not escrowed here");
            Assert.That(cash.EscrowDeposit, Is.EqualTo(2_443.74m), "three months of it");
            Assert.That(cash.ClosingCosts, Is.EqualTo(10_478.09m), "4,000 + 1,000 + 634.35 + 2,400 + 2,443.74");
            Assert.That(cash.Credits, Is.EqualTo(3_000m), "all the credits are used");
            Assert.That(cash.UnusedCredits, Is.Zero, "none is left over");
            Assert.That(cash.Total, Is.EqualTo(19_978.09m), "12,500 + 10,478.09 − 3,000");
        });
    }

    [Test]
    public void ABuydownTheBuyerPaysFor_IsInTheCashToClose()
    {
        var response = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithBuydownPaidBy(BuydownFunding.Borrower).WithClosingCosts());

        Assert.Multiple(() =>
        {
            Assert.That(response.CashToClose!.BuydownCost, Is.EqualTo(response.Buydown!.TotalSubsidy), "the whole subsidy is deposited at closing");
            Assert.That(response.CashToClose.BuydownCost, Is.GreaterThan(0m), "and a 2-1 buydown has one");
        });
    }

    [Test]
    public void ABuydownTheSellerPaysFor_IsNot()
    {
        var response = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithBuydownPaidBy(BuydownFunding.Seller).WithClosingCosts());

        Assert.That(response.CashToClose!.BuydownCost, Is.Zero, "the seller's money, not the buyer's");
    }

    [Test]
    public void TheDailyInterest_IsAtTheNoteRate_EvenWithABuydown()
    {
        var cash = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithClosingCosts()).CashToClose!;

        Assert.That(cash.DailyInterest, Is.EqualTo(42.29m), "interest before the first payment accrues at the note rate, 6.5%");
    }

    [Test]
    public void TheSellersCredits_AreMeasuredAgainstTheLimit()
    {
        var cash = Service.Analyze(TexasPurchase().WithClosingCosts(credits: 3_000m)).CashToClose!;

        Assert.Multiple(() =>
        {
            Assert.That(cash.SellerCredits, Is.EqualTo(3_000m), "the seller's credits are used");
            Assert.That(cash.Concessions.LimitPercent, Is.EqualTo(3m), "a conventional loan above 90% of the price");
            Assert.That(cash.Concessions.Limit, Is.EqualTo(7_500m), "3% of $250,000");
            Assert.That(cash.Concessions.Total, Is.EqualTo(3_000m), "the seller pays $3,000 of it");
            Assert.That(cash.Concessions.OverLimit, Is.Zero, "within the limit");
            Assert.That(cash.Concessions.NormalClosingCostsExcluded, Is.False, "all of it counts on a conventional loan");
            Assert.That(cash.Concessions.NextTier, Is.EqualTo(new ConcessionTierResponse(25_000m, 6m, 15_000m)), "10% down would make it 6%");
        });
    }

    [Test]
    public void AnInvestmentProperty_HoldsTheSellerTo2Percent()
    {
        // 15% down, the least an investment property's conventional loan allows; $5,500 of credits is past 2%.
        var request = A.Request.WithHomePrice(250_000m).WithDownPayment(37_500m).WithOccupancy(OccupancyType.InvestmentProperty)
            .WithClosingCosts(credits: 5_500m);

        var cash = Service.Analyze(request).CashToClose!;

        Assert.Multiple(() =>
        {
            Assert.That(cash.Concessions.LimitPercent, Is.EqualTo(2m), "Fannie Mae's limit for an investment property");
            Assert.That(cash.Concessions.Limit, Is.EqualTo(5_000m), "2% of $250,000");
            Assert.That(cash.Concessions.OverLimit, Is.EqualTo(500m), "$500 of the credits cannot pay costs");
            Assert.That(cash.Concessions.NextTier, Is.Null, "more down does not raise it");
        });
    }

    [Test]
    public void TheLendersCredits_AreNotTheSellers()
    {
        var cash = Service.Analyze(TexasPurchase().WithClosingCosts(credits: 3_000m, lenderCredits: 1_000m)).CashToClose!;

        Assert.Multiple(() =>
        {
            Assert.That(cash.LenderCredits, Is.EqualTo(1_000m), "the lender's credit is used");
            Assert.That(cash.Credits, Is.EqualTo(4_000m), "with the seller's");
            Assert.That(cash.Concessions.Total, Is.EqualTo(3_000m), "only the seller's count toward the limit");
            Assert.That(cash.Total, Is.EqualTo(18_978.09m), "12,500 + 10,478.09 − 4,000");
        });
    }

    [Test]
    public void ABuydownTheSellerPaysFor_CountsAgainstTheLimit_AndCreditsOverItAreNotAllowed()
    {
        var response = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithBuydownPaidBy(BuydownFunding.Seller).WithClosingCosts(credits: 3_000m));
        var (cash, subsidy) = (response.CashToClose!, response.Buydown!.TotalSubsidy);

        Assert.Multiple(() =>
        {
            Assert.That(cash.Concessions.SellerBuydown, Is.EqualTo(subsidy), "the seller's buydown is a concession");
            Assert.That(cash.Concessions.Total, Is.EqualTo(subsidy + 3_000m), "with the credits");
            Assert.That(cash.Concessions.OverLimit, Is.EqualTo(subsidy + 3_000m - 7_500m), "a 2-1 buydown and $3,000 is more than $7,500");
            Assert.That(cash.SellerCredits, Is.EqualTo(7_500m - subsidy), "so the credits are allowed only up to the limit");
        });
    }

    [Test]
    public void ABuydownTheBuyerPaysFor_IsNotAConcession()
    {
        var cash = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithBuydownPaidBy(BuydownFunding.Borrower).WithClosingCosts()).CashToClose!;

        Assert.That(cash.Concessions.Total, Is.Zero, "the buyer's own money");
    }

    [Test]
    public void AnFhaLoan_Allows6Percent()
    {
        var cash = Service.Analyze(TexasPurchase().WithProgram(LoanProgramType.Fha).WithClosingCosts()).CashToClose!;

        Assert.Multiple(() =>
        {
            Assert.That(cash.Concessions.Limit, Is.EqualTo(15_000m), "6% of $250,000");
            Assert.That(cash.Concessions.NextTier, Is.Null, "putting more down does not change it");
        });
    }

    [Test]
    public void AVaLoan_Allows4Percent_BesidesTheNormalClosingCosts()
    {
        var cash = Service.Analyze(TexasPurchase().WithProgram(LoanProgramType.Va).WithClosingCosts(credits: 10_000m)).CashToClose!;

        Assert.Multiple(() =>
        {
            Assert.That(cash.Concessions.Limit, Is.EqualTo(10_000m), "4% of $250,000");
            Assert.That(cash.Concessions.NormalClosingCostsExcluded, Is.True, "the seller may pay the normal closing costs besides");
            // The 1.5% funding fee is financed, so a day of interest is on $241,062.50: $42.93. The fees and 15 days of interest
            // (5,643.95) are normal closing costs; the rest of the $10,000 counts.
            Assert.That(cash.Concessions.Total, Is.EqualTo(4_356.05m), "only what pays the insurance and escrow counts");
        });
    }

    [Test]
    public void WithoutClosingCosts_ThereIsNoCashToClose()
    {
        Assert.That(Service.Analyze(TexasPurchase()).CashToClose, Is.Null, "a request without closing costs gets no estimate of them");
    }
}
