using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for cash to close: the closing costs priced from the loan and its first year of costs. The
/// purchase is <see cref="FivePercentDown"/>: $250,000 with $12,500 down, so $237,500 at 6.5%. Expected values were
/// worked by hand and checked in Python <c>Decimal</c>.
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
    public void WithoutClosingCosts_ThereIsNoCashToClose()
    {
        Assert.That(Service.Analyze(TexasPurchase()).CashToClose, Is.Null, "a request without closing costs gets no estimate of them");
    }
}
