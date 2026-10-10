using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Refinancing;
using static MortgageAnalytics.Testing.ReferenceRefinances;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// <see cref="RefinanceService"/> with the real domain analyzer behind it (sociable), checked against the
/// independently computed <see cref="ReferenceRefinances"/>. This pins the whole mapping, both ways.
/// </summary>
[TestFixture]
public class RefinanceServiceTests
{
    private RefinanceService _service = null!;

    [SetUp]
    public void CreateService() => _service = new RefinanceService(new RefinanceAnalyzer(new AmortizationCalculator()), TestClock.Create());

    private static RefinanceRequest Request(bool financeClosingCosts = false, DateOnly? nextPaymentDate = null) => new()
    {
        CurrentBalance = Current.Balance,
        CurrentAnnualInterestRate = Current.AnnualInterestRate,
        RemainingTermInMonths = Current.RemainingTermInMonths,
        NextPaymentDate = nextPaymentDate ?? ReferenceLoans.FirstPaymentDate,
        NewAnnualInterestRate = ToSixPercentFor30Years.AnnualInterestRate,
        NewTermInMonths = ToSixPercentFor30Years.TermInMonths,
        ClosingCosts = ToSixPercentFor30Years.ClosingCosts,
        FinanceClosingCosts = financeClosingCosts,
    };

    [Test]
    public void Analyze_ReportsTheComparison()
    {
        var response = _service.Analyze(Request());

        Assert.Multiple(() =>
        {
            Assert.That(response.Current.MonthlyPayment, Is.EqualTo(Current.MonthlyPayment), "today's payment");
            Assert.That(response.Refinanced.MonthlyPayment, Is.EqualTo(ToSixPercentFor30Years.MonthlyPayment), "the new payment");
            Assert.That(response.MonthlySavings, Is.EqualTo(ToSixPercentFor30Years.MonthlySavings), "the monthly difference");
            Assert.That(response.LifetimeSavings, Is.EqualTo(ToSixPercentFor30Years.LifetimeSavings), "the lifetime result, closing costs included");
            Assert.That(response.InterestSaved, Is.EqualTo(Current.TotalInterest - ToSixPercentFor30Years.TotalInterest), "interest left minus new interest");
            Assert.That(response.MonthsAdded, Is.EqualTo(ToSixPercentFor30Years.MonthsAdded), "the clock restarting");
            Assert.That(response.BreakEvenPaymentNumber, Is.EqualTo(ToSixPercentFor30Years.BreakEvenPaymentNumber), "the break-even payment");
            Assert.That(response.BreakEvenDate, Is.EqualTo(ToSixPercentFor30Years.BreakEvenDate), "and its date");
            Assert.That(response.UpfrontCosts, Is.EqualTo(ToSixPercentFor30Years.ClosingCosts), "the costs are due at closing");
        });
    }

    [Test]
    public void Analyze_DescribesKeepingTodaysPayment_AsExtraPrincipalOnTheNewLoan()
    {
        var keeping = _service.Analyze(Request()).KeepingCurrentPayment;

        Assert.Multiple(() =>
        {
            Assert.That(keeping, Is.Not.Null, "the new payment is lower, so the option applies");
            Assert.That(keeping!.MonthlyPayment + keeping.ExtraMonthlyPrincipal, Is.EqualTo(Current.MonthlyPayment), "together they are today's payment");
            Assert.That(keeping.NumberOfPayments, Is.EqualTo(ToSixPercentFor30Years.KeepingCurrentPayment.NumberOfPayments), "and it pays off sooner");
            Assert.That(keeping.PayoffDate, Is.EqualTo(ToSixPercentFor30Years.KeepingCurrentPayment.PayoffDate), "on this date");
        });
    }

    [Test]
    public void Analyze_WithFinancedCosts_ReportsTheLargerLoanAndNothingDueAtClosing()
    {
        var response = _service.Analyze(Request(financeClosingCosts: true));

        Assert.Multiple(() =>
        {
            Assert.That(response.Refinanced.LoanAmount, Is.EqualTo(ToSixPercentWithCostsFinanced.LoanAmount), "balance plus costs");
            Assert.That(response.UpfrontCosts, Is.Zero, "no cash at closing");
            Assert.That(response.Current.LoanAmount, Is.EqualTo(Current.Balance), "the current loan is just its balance");
        });
    }

    [Test]
    public void Analyze_IncludesEveryPayment_UnlessAskedForSummariesOnly()
    {
        var full = _service.Analyze(Request());
        var summaries = _service.Analyze(Request(), includePayments: false);

        Assert.Multiple(() =>
        {
            Assert.That(full.Refinanced.Payments, Has.Count.EqualTo(ToSixPercentFor30Years.TermInMonths), "one row per payment");
            Assert.That(full.Refinanced.Payments[^1].RemainingBalance, Is.Zero, "ending at zero");
            Assert.That(summaries.Current.Payments, Is.Empty, "summaries only");
            Assert.That(summaries.KeepingCurrentPayment!.Payments, Is.Empty, "for every option");
        });
    }

    [Test]
    public void Analyze_DefaultsTheNextPaymentToTheFirstOfNextMonth()
    {
        var response = _service.Analyze(Request() with { NextPaymentDate = null });

        Assert.That(response.Current.Payments[0].DueDate, Is.EqualTo(TestClock.FirstOfNextMonth), "both loans start with next month's payment");
    }
}
