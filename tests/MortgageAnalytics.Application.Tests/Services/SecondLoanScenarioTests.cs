using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for a second loan instead of PMI: a $250,000 home with 10% down at 6.5% (so PMI), against
/// borrowing the other 10% as a second loan at 8% over 15 years, which leaves a first loan at 80% and no PMI. Each way is
/// the request analyzed again, so it is priced as the calculator prices any loan.
/// </summary>
[TestFixture]
public class SecondLoanScenarioTests : SociableAnalysisTestBase
{
    private static AmortizationRequestBuilder Purchase() =>
        A.Request.WithHomePrice(250_000m).WithDownPayment(25_000m).WithRate(6.5m)
            .WithHousingCosts(c => c.WithPropertyTax(1.0m).WithInsurance(2_400m).WithPmi(0.5m));

    [Test]
    public void ThereIsNone_UnlessAskedFor()
    {
        Assert.That(Service.Analyze(Purchase()).SecondLoan, Is.Null, "nothing to compare");
    }

    [Test]
    public void TheSecondLoan_TakesPartOfTheLoan_SoTheFirstIsSmaller_AndHasNoPmi()
    {
        var response = Service.Analyze(Purchase().WithSecondLoan(25_000m, 8m));
        var second = response.SecondLoan!;

        Assert.Multiple(() =>
        {
            Assert.That(second.WithMortgageInsurance.FirstLoan, Is.EqualTo(225_000m), "as given: $250,000 less the $25,000 down");
            Assert.That(second.WithMortgageInsurance.SecondLoan, Is.EqualTo(0m), "no second loan");
            Assert.That(second.WithMortgageInsurance.MortgageInsurance, Is.GreaterThan(0m), "90% of the price needs PMI");
            Assert.That(second.WithSecondLoan.FirstLoan, Is.EqualTo(200_000m), "less the $25,000 borrowed again: 80% of the price");
            Assert.That(second.WithSecondLoan.SecondLoan, Is.EqualTo(25_000m), "the second loan");
            Assert.That(second.WithSecondLoan.MortgageInsurance, Is.EqualTo(0m), "a first loan at 80% needs no PMI");
        });
    }

    [Test]
    public void TheSecondLoansPayment_IsTheLevelPaymentOverItsTerm()
    {
        var second = Service.Analyze(Purchase().WithSecondLoan(25_000m, 8m, termInMonths: 180)).SecondLoan!;

        // 25,000 × (0.08/12) ÷ (1 − (1 + 0.08/12)^−180) = $238.91.
        Assert.That(second.WithSecondLoan.SecondLoanPayment, Is.EqualTo(238.91m), "the level payment on $25,000 at 8% over 15 years");
    }

    [Test]
    public void TheCashToClose_IsTheSame_BecauseTheSecondLoanReplacesDownPaymentOnlyInTheLoan()
    {
        var response = Service.Analyze(Purchase().WithClosingCosts().WithSecondLoan(25_000m, 8m));
        var second = response.SecondLoan!;

        Assert.Multiple(() =>
        {
            Assert.That(second.WithMortgageInsurance.CashToClose, Is.EqualTo(response.CashToClose!.Total), "the request as made");
            Assert.That(second.WithSecondLoan.CashToClose, Is.GreaterThan(0m), "something is brought to closing");
            Assert.That(second.WithSecondLoan.CashToClose, Is.LessThan(second.WithMortgageInsurance.CashToClose + 2_000m), "the same down payment and similar closing costs");
        });
    }

    [Test]
    public void TheMonthlyPayment_IsTheFirstLoansWithItsCosts_PlusTheSecondLoansPayment()
    {
        var response = Service.Analyze(Purchase().WithSecondLoan(25_000m, 8m));
        var smaller = Service.Analyze(Purchase().WithDownPayment(50_000m));
        var option = response.SecondLoan!.WithSecondLoan;

        Assert.Multiple(() =>
        {
            Assert.That(option.FirstLoanPayment, Is.EqualTo(smaller.Baseline.Payments[0].Principal + smaller.Baseline.Payments[0].Interest), "the first loan alone, as the calculator works it out");
            Assert.That(option.MonthlyPayment, Is.EqualTo(smaller.Baseline.TotalMonthlyPayment + option.SecondLoanPayment), "all of it: the first loan, taxes, insurance and dues, and the second loan");
        });
    }

    [Test]
    public void TheCost_IsTheCashToClose_EveryPaymentInTheYearsKept_AndWhatIsStillOwed()
    {
        var second = Service.Analyze(Purchase().WithSecondLoan(25_000m, 8m, yearsKept: 7)).SecondLoan!;

        Assert.Multiple(() =>
        {
            Assert.That(second.WithSecondLoan.Cost, Is.EqualTo(second.WithSecondLoan.CashToClose + second.WithSecondLoan.Payments + second.WithSecondLoan.Balance), "what the buyer pays");
            Assert.That(second.WithMortgageInsurance.Cost, Is.EqualTo(second.WithMortgageInsurance.CashToClose + second.WithMortgageInsurance.Payments + second.WithMortgageInsurance.Balance), "and the same for PMI");
            Assert.That(second.Saved, Is.EqualTo(second.WithMortgageInsurance.Cost - second.WithSecondLoan.Cost), "what the second loan saves, negative when it costs more");
            Assert.That(second.WithSecondLoan.Balance, Is.GreaterThan(0m), "a first loan still owes after seven years");
        });
    }

    [Test]
    public void ADearSecondLoan_CostsMoreThanPmi_AndAnInexpensiveOneSaves()
    {
        var dear = Service.Analyze(Purchase().WithSecondLoan(25_000m, 14m)).SecondLoan!;
        var cheap = Service.Analyze(Purchase().WithSecondLoan(25_000m, 6.5m)).SecondLoan!;

        Assert.Multiple(() =>
        {
            Assert.That(dear.Saved, Is.LessThan(cheap.Saved), "the dearer the second loan, the less it saves");
            Assert.That(cheap.Saved, Is.GreaterThan(0m), "at the first loan's own rate it beats PMI");
        });
    }

    [Test]
    public void AShortSecondLoan_IsPaidOffWithinTheYearsKept_SoNothingIsOwedOnIt()
    {
        var second = Service.Analyze(Purchase().WithSecondLoan(25_000m, 8m, termInMonths: 60, yearsKept: 7)).SecondLoan!;
        var longer = Service.Analyze(Purchase().WithSecondLoan(25_000m, 8m, termInMonths: 180, yearsKept: 7)).SecondLoan!;

        Assert.That(second.WithSecondLoan.Balance, Is.LessThan(longer.WithSecondLoan.Balance), "five years repay it, so only the first loan's balance is left");
    }

    [Test]
    public void ExtraPayments_AreLeftOutOfBothWays()
    {
        var plain = Service.Analyze(Purchase().WithSecondLoan(25_000m, 8m)).SecondLoan!;
        var extra = Service.Analyze(Purchase().WithMonthlyExtra(300m).WithSecondLoan(25_000m, 8m)).SecondLoan!;

        Assert.That(extra, Is.EqualTo(plain), "extra principal is an investment choice, not part of this one");
    }
}
