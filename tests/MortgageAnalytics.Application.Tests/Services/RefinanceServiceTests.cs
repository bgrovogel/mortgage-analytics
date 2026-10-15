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
    public void Analyze_WithCashOut_BorrowsItAndCountsItAsMoneyInHand()
    {
        var response = _service.Analyze(Request() with { CashOut = ToSixPercentTakingFiftyThousandOut.CashOut });

        Assert.Multiple(() =>
        {
            Assert.That(response.Refinanced.LoanAmount, Is.EqualTo(ToSixPercentTakingFiftyThousandOut.LoanAmount), "the balance plus the cash");
            Assert.That(response.Refinanced.MonthlyPayment, Is.EqualTo(ToSixPercentTakingFiftyThousandOut.MonthlyPayment), "its payment");
            Assert.That(response.CashOut, Is.EqualTo(50_000m), "the cash received");
            Assert.That(response.NetCash, Is.EqualTo(44_000m), "less the closing costs paid up front");
            Assert.That(response.LifetimeSavings, Is.EqualTo(ToSixPercentTakingFiftyThousandOut.LifetimeSavings), "the cost in all, net of the cash");
        });
    }

    [Test]
    public void Analyze_WithCashOutAndAHomeValue_SaysWhetherTheLoanIsWithinTheCashOutLimit()
    {
        var within = _service.Analyze(Request() with { CashOut = 50_000m, HomeValue = 500_000m });
        var over = _service.Analyze(Request() with { CashOut = 50_000m, HomeValue = 400_000m });
        var plain = _service.Analyze(Request() with { HomeValue = 300_000m });

        Assert.Multiple(() =>
        {
            Assert.That(within.NewLoanToValuePercent, Is.EqualTo(70m), "$350,000 of a $500,000 home");
            Assert.That(within.ExceedsCashOutLimit, Is.False, "within 80%");
            Assert.That(over.NewLoanToValuePercent, Is.EqualTo(87.5m), "$350,000 of a $400,000 home");
            Assert.That(over.ExceedsCashOutLimit, Is.True, "over the 80% a cash-out refinance allows");
            Assert.That(plain.ExceedsCashOutLimit, Is.False, "the limit is for taking cash out: a plain refinance is not held to it");
        });
    }

    [Test]
    public void Analyze_WithoutAHomeValue_SaysNothingOfLoanToValue()
    {
        var response = _service.Analyze(Request() with { CashOut = 50_000m });

        Assert.Multiple(() =>
        {
            Assert.That(response.NewLoanToValuePercent, Is.Null, "there is no value to measure it against");
            Assert.That(response.ExceedsCashOutLimit, Is.False, "and so no limit to exceed");
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
    public void Analyze_IncludesEveryPayment()
    {
        var full = _service.Analyze(Request());

        Assert.Multiple(() =>
        {
            Assert.That(full.Refinanced.Payments, Has.Count.EqualTo(ToSixPercentFor30Years.TermInMonths), "one row per payment");
            Assert.That(full.Refinanced.Payments[^1].RemainingBalance, Is.Zero, "ending at zero");
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
            Assert.That(reset.EffectiveDate, Is.EqualTo(ReferenceLoans.FirstPaymentDate.AddMonths(24)), "with the 25th payment from the next one");
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
            Assert.That(response.NewBuydown!.Years.Select(y => (y.AnnualInterestRate, y.MonthlyPayment, y.Subsidy)), Is.EqualTo(new[]
            {
                (4m, 1_432.25m, 4_396.80m), (5m, 1_610.46m, 2_258.28m), (6m, ToSixPercentFor30Years.MonthlyPayment, 0m),
            }), "paid back as lower payments for two years: 12 gaps of $366.40, then 12 of $188.19");
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

    [Test]
    public void ARefinanceToAHigherPayment_HasNoKeepTodaysPaymentOption()
    {
        var response = _service.Analyze(Request() with { NewAnnualInterestRate = 9m });

        Assert.That(response.KeepingCurrentPayment, Is.Null, "paying today's payment on a dearer loan would not pay it off");
    }

    [Test]
    public void Analyze_WithAHomeValue_ShowsThePmiOnEachLoan_AndCountsIt()
    {
        // $300,000 on a home worth $360,000: both loans carry PMI until $288,000.
        var response = _service.Analyze(Request() with { HomeValue = 360_000m, CurrentMonthlyPmi = 120m, NewPmiRate = 0.5m });
        var without = _service.Analyze(Request());

        Assert.Multiple(() =>
        {
            Assert.That(response.Current.MonthlyPmi, Is.EqualTo(120m), "today's PMI");
            Assert.That(response.Refinanced.MonthlyPmi, Is.EqualTo(125m), "0.5% of $300,000 a year on the new loan");
            Assert.That(response.Current.TotalPmi, Is.Positive, "PMI left on the current loan");
            Assert.That(response.Refinanced.PmiEndDate, Is.GreaterThan(response.Current.PmiEndDate!.Value), "a new 30 years keeps it longer");
            Assert.That(response.MonthlySavings, Is.EqualTo(without.MonthlySavings - 5m), "$5 more PMI a month");
            Assert.That(response.LifetimeSavings,
                Is.EqualTo(without.LifetimeSavings + response.Current.TotalPmi - response.Refinanced.TotalPmi), "both counted in the total");
        });
    }

    [Test]
    public void Analyze_WithoutAHomeValue_LeavesPmiOut()
    {
        var response = _service.Analyze(Request());

        Assert.Multiple(() =>
        {
            Assert.That(response.Current.TotalPmi, Is.Zero, "no value to measure 80% against");
            Assert.That(response.Refinanced.MonthlyPmi, Is.Zero, "on either loan");
            Assert.That(response.Refinanced.PmiEndDate, Is.Null, "so no end date");
        });
    }

    [Test]
    public void Analyze_EndsEachLoansPmi_WithItsLastPaymentAbove80Percent()
    {
        var response = _service.Analyze(Request() with { HomeValue = 360_000m, CurrentMonthlyPmi = 120m });
        var current = response.Current.Payments;
        // Each payment opens at the balance the one before it left; the first at what is owed today.
        var last = Enumerable.Range(0, current.Count).Last(i => (i == 0 ? Current.Balance : current[i - 1].RemainingBalance) > 288_000m);

        Assert.Multiple(() =>
        {
            Assert.That(response.Current.PmiEndDate, Is.EqualTo(current[last].DueDate), "the last payment that opens above $288,000");
            Assert.That(response.Current.TotalPmi, Is.EqualTo((last + 1) * 120m), "$120 with each payment until then");
        });
    }
}
