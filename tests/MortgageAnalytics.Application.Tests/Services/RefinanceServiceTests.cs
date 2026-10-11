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
    public void CreateService() => _service = new RefinanceService(new RefinanceAnalyzer(new AmortizationCalculator()), new AmortizationCalculator(), TestClock.Create());

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
    public void Analyze_GivenTheOriginalLoan_StartsFromWhatIsOwedToday_OnThatLoansOwnSchedule()
    {
        // The reference loan ($200,000 at 6% over 30 years from January 2026), on the test clock's 9 October 2026:
        // ten payments made, 197,963.60 owed (computed independently), November's payment next.
        var request = Request() with
        {
            CurrentBalance = 0,
            RemainingTermInMonths = 0,
            CurrentAnnualInterestRate = 6m,
            OriginalLoan = new OriginalLoanRequest { Amount = 200_000m, TermInMonths = 360, FirstPaymentDate = ReferenceLoans.FirstPaymentDate },
        };

        var current = _service.Analyze(request).Current;

        Assert.Multiple(() =>
        {
            Assert.That(current.LoanAmount, Is.EqualTo(197_963.60m), "what is owed after ten payments");
            Assert.That(current.NumberOfPayments, Is.EqualTo(350), "the payments left");
            Assert.That(current.MonthlyPayment, Is.EqualTo(ReferenceLoans.Standard.MonthlyPayment), "the original payment carries on");
            Assert.That(current.Payments[0].DueDate, Is.EqualTo(new DateOnly(2026, 11, 1)), "starting with the next due date");
            Assert.That(current.PayoffDate, Is.EqualTo(ReferenceLoans.Standard.PayoffDate), "and ending when the original loan would");
        });
    }

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

    private static AdjustableRateRequest Arm(int fixedMonths, decimal expected, decimal initialCap, decimal periodicCap, decimal lifetimeCap) =>
        new() { InitialFixedMonths = fixedMonths, AdjustmentIntervalMonths = 12, ExpectedRate = expected, InitialCap = initialCap, PeriodicCap = periodicCap, LifetimeCap = lifetimeCap };

    // Expected values below come from tools/rate-check/rate_model.py, which reproduces the fixed-rate reference
    // refinance (-17,415.28) exactly.

    [Test]
    public void ACurrentArmAboutToReset_MakesRefinancingWorthIt_AndTheWorstCaseMoreSo()
    {
        var response = _service.Analyze(Request() with { CurrentAdjustableRate = Arm(24, 9m, 2m, 2m, 5m) });
        var reset = response.Current.RateChanges.Single();

        Assert.Multiple(() =>
        {
            Assert.That((reset.PaymentNumber, reset.PreviousRate, reset.NewRate, reset.PreviousPayment, reset.NewPayment),
                Is.EqualTo((25, 7m, 9m, 2_120.34m, 2_496.08m)), "today's 7% resets to 9% after two years");
            Assert.That(response.MonthlySavings, Is.EqualTo(ToSixPercentFor30Years.MonthlySavings), "today's payment is still today's");
            Assert.That(response.LifetimeSavings, Is.EqualTo(86_292.68m), "the reset turns a $17,415 loss into a saving");
            Assert.That(response.WorstCaseLifetimeSavings, Is.EqualTo(239_046.91m), "and if rates rise as far as the caps allow (9%, 11%, 12%), much more");
        });
    }

    [Test]
    public void ANewArm_StartsLower_ButItsResetsCount_AndSoDoesTheWorstCase()
    {
        var response = _service.Analyze(Request() with { NewAnnualInterestRate = 5.5m, NewAdjustableRate = Arm(60, 7m, 2m, 1m, 5m) });
        var reset = response.Refinanced.RateChanges.Single();

        Assert.Multiple(() =>
        {
            Assert.That(response.Refinanced.MonthlyPayment, Is.EqualTo(1_703.37m), "5.5% for the first five years");
            Assert.That((reset.PaymentNumber, reset.NewRate, reset.NewPayment), Is.EqualTo((61, 7m, 1_960.48m)), "then 7%");
            Assert.That(response.LifetimeSavings, Is.EqualTo(-60_241.97m), "costing more over the life of the loan");
            Assert.That(response.WorstCaseLifetimeSavings, Is.EqualTo(-236_278.22m), "and far more if rates rise as the caps allow");
        });
    }

    [Test]
    public void ABuydownOnTheNewLoan_IsPaidAtClosing_AndComesBackInLowerPayments_ChangingNothingOverall()
    {
        var response = _service.Analyze(Request() with { NewBuydown = new TemporaryBuydownRequest { YearlyReductions = [2m, 1m] } });

        Assert.Multiple(() =>
        {
            Assert.That(response.BuydownCost, Is.EqualTo(6_655.08m), "the 2-1 buydown's cost");
            Assert.That(response.UpfrontCosts, Is.EqualTo(ToSixPercentFor30Years.ClosingCosts + 6_655.08m), "due at closing, with the closing costs");
            Assert.That(response.NewBuydown!.Years.Select(y => (y.AnnualInterestRate, y.MonthlyPayment)), Is.EqualTo(new[]
            {
                (4m, 1_432.25m), (5m, 1_610.46m), (6m, ToSixPercentFor30Years.MonthlyPayment),
            }), "paid back as lower payments for two years");
            Assert.That(response.LifetimeSavings, Is.EqualTo(ToSixPercentFor30Years.LifetimeSavings), "so it changes nothing over the life of the loan");
            Assert.That(response.BreakEvenPaymentNumber, Is.EqualTo(ToSixPercentFor30Years.BreakEvenPaymentNumber), "nor the break-even");
            Assert.That(response.WorstCaseLifetimeSavings, Is.Null, "neither loan adjusts");
        });
    }

    [Test]
    public void AnArmGivenByItsOriginalLoan_CountsItsFixedPeriodFromTheFirstPayment()
    {
        // $200,000 at 6% from January 2026, fixed for 12 payments: on the test clock (9 October 2026) ten are made,
        // so the reset to 8% comes with the third payment from now.
        var response = _service.Analyze(Request() with
        {
            CurrentAnnualInterestRate = 6m,
            OriginalLoan = new OriginalLoanRequest { Amount = 200_000m, TermInMonths = 360, FirstPaymentDate = ReferenceLoans.FirstPaymentDate },
            CurrentAdjustableRate = Arm(12, 8m, 2m, 2m, 5m),
        });
        var reset = response.Current.RateChanges.Single();

        Assert.Multiple(() =>
        {
            Assert.That(response.Current.LoanAmount, Is.EqualTo(197_963.60m), "what is owed today, as before");
            Assert.That((reset.PaymentNumber, reset.NewRate), Is.EqualTo((3, 8m)), "the reset two payments from now");
        });
    }
}
