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

    // The scenario below was computed independently in Python Decimal (interest = balance x rate / 1,200 to the cent):
    // $300,000 at 7% with 25 years to go; $50,000 taken out either as an 8% home-equity loan over 15 years beside it, or
    // in a refinance to 6% for 30 years ($350,000, $6,000 of closing costs); both costed over 7 years (84 payments).
    private static RefinanceRequest WithAHomeEquityLoan(decimal? homeValue = 500_000m) => Request() with
    {
        CashOut = 50_000m,
        HomeValue = homeValue,
        HomeEquityLoan = new HomeEquityLoanRequest { AnnualInterestRate = 8m, TermInMonths = 180, YearsKept = 7 },
    };

    [Test]
    public void Analyze_WithoutAHomeEquityLoan_HasNoHomeEquityComparison() =>
        Assert.That(_service.Analyze(Request() with { CashOut = 50_000m }).HomeEquity, Is.Null, "it is only worked out when asked for");

    [Test]
    public void Analyze_ComparesBorrowingTheCashAsAHomeEquityLoanWithRefinancingToTakeItOut()
    {
        var equity = _service.Analyze(WithAHomeEquityLoan()).HomeEquity!;

        Assert.Multiple(() =>
        {
            Assert.That(equity.Amount, Is.EqualTo(50_000m), "the cash taken out is what is borrowed");
            Assert.That(equity.KeepAndBorrow.MonthlyPayment, Is.EqualTo(2_598.17m), "today's 2,120.34 and the home-equity loan's 477.83");
            Assert.That(equity.KeepAndBorrow.EquityLoanPayment, Is.EqualTo(477.83m), "of which the home-equity loan");
            Assert.That(equity.KeepAndBorrow.Payments, Is.EqualTo(218_246.28m), "84 payments on both loans");
            Assert.That(equity.KeepAndBorrow.StillOwed, Is.EqualTo(293_803.71m), "what is left on both after 7 years");
            Assert.That(equity.KeepAndBorrow.UpfrontCosts, Is.Zero, "a home-equity loan's own costs are not counted");
            Assert.That(equity.KeepAndBorrow.Cost, Is.EqualTo(512_049.99m), "paid and still owed");
            Assert.That(equity.CashOutRefinance.MonthlyPayment, Is.EqualTo(2_098.43m), "one new loan of $350,000 at 6%");
            Assert.That(equity.CashOutRefinance.Payments, Is.EqualTo(176_268.12m), "84 payments on it");
            Assert.That(equity.CashOutRefinance.StillOwed, Is.EqualTo(313_737.59m), "what is left on it after 7 years");
            Assert.That(equity.CashOutRefinance.UpfrontCosts, Is.EqualTo(6_000m), "paid at closing");
            Assert.That(equity.CashOutRefinance.Cost, Is.EqualTo(496_005.71m), "paid, still owed and the closing costs");
            Assert.That(equity.SavedByEquityLoan, Is.EqualTo(-16_044.28m), "the home-equity loan costs this much more: keeping the 7% loan costs more than refinancing to 6%");
            Assert.That(equity.YearsKept, Is.EqualTo(7), "the years it is costed over");
        });
    }

    [Test]
    public void Analyze_SaysHowMuchEquityCouldBeBorrowed_AndWhereTheCombinedLoansStand()
    {
        var within = _service.Analyze(WithAHomeEquityLoan(500_000m)).HomeEquity!;
        var over = _service.Analyze(WithAHomeEquityLoan(400_000m)).HomeEquity!;
        var unknown = _service.Analyze(WithAHomeEquityLoan(null)).HomeEquity!;

        Assert.Multiple(() =>
        {
            Assert.That(within.AvailableEquity, Is.EqualTo(100_000m), "80% of $500,000 less the $300,000 owed");
            Assert.That(within.CombinedLoanToValuePercent, Is.EqualTo(70m), "$350,000 of $500,000");
            Assert.That(within.ExceedsLimit, Is.False, "within the 80% lenders allow");
            Assert.That(over.AvailableEquity, Is.EqualTo(20_000m), "80% of $400,000 less the $300,000 owed");
            Assert.That(over.CombinedLoanToValuePercent, Is.EqualTo(87.5m), "$350,000 of $400,000");
            Assert.That(over.ExceedsLimit, Is.True, "more than that is not offered");
            Assert.That(unknown.AvailableEquity, Is.Null, "nothing is known of the equity without a home value");
            Assert.That(unknown.CombinedLoanToValuePercent, Is.Null, "nor of the loan to value");
            Assert.That(unknown.ExceedsLimit, Is.False, "and nothing is said to be over a limit");
        });
    }

    // The same cash as a home-equity line of credit, drawn at once: 8% interest only for 120 months, then repaid over 240 months at
    // the rate expected by then. Computed independently in Python Decimal (tools/calculator-check), costed over `yearsKept` years.
    private static RefinanceRequest WithALine(int yearsKept, decimal? repaymentRate) => WithAHomeEquityLoan() with
    {
        HomeEquityLoan = new HomeEquityLoanRequest
        {
            AnnualInterestRate = 8m, TermInMonths = 240, YearsKept = yearsKept, DrawPeriodInMonths = 120, RepaymentRate = repaymentRate,
        },
    };

    [Test]
    public void Analyze_CostsALineOfCredit_AsInterestOnlyWhileItIsDrawn()
    {
        var equity = _service.Analyze(WithALine(yearsKept: 7, repaymentRate: 9m)).HomeEquity!;

        Assert.Multiple(() =>
        {
            Assert.That(equity.KeepAndBorrow.EquityLoanPayment, Is.EqualTo(333.33m), "$50,000 at 8% a year, interest only: 50,000 x 8% / 12");
            Assert.That(equity.KeepAndBorrow.MonthlyPayment, Is.EqualTo(2_453.67m), "today's 2,120.34 and the line's 333.33");
            Assert.That(equity.RepaymentPayment, Is.EqualTo(449.86m), "$50,000 over 240 months at 9%, once repayment begins");
            Assert.That(equity.RepaymentRate, Is.EqualTo(9m), "the rate expected by then");
            Assert.That(equity.DrawPeriodInMonths, Is.EqualTo(120), "ten years of drawing");
            Assert.That(equity.KeepAndBorrow.Payments, Is.EqualTo(206_108.28m), "84 payments on today's loan, and 84 of interest on the line");
            Assert.That(equity.KeepAndBorrow.StillOwed, Is.EqualTo(310_003.67m), "what is left of today's loan, and all $50,000 of the line: none of it is paid down while drawing");
            Assert.That(equity.KeepAndBorrow.Cost, Is.EqualTo(516_111.95m), "paid and still owed");
            Assert.That(equity.CashOutRefinance.Cost, Is.EqualTo(496_005.71m), "the refinance is priced as for a loan");
            Assert.That(equity.SavedByEquityLoan, Is.EqualTo(-20_106.24m), "the line costs this much more than refinancing");
        });
    }

    [Test]
    public void Analyze_CostsALineOfCredit_AcrossTheEndOfItsDrawPeriod()
    {
        // 12 years kept: 120 months of interest only, then 24 of repayment at 9%.
        var equity = _service.Analyze(WithALine(yearsKept: 12, repaymentRate: 9m)).HomeEquity!;

        Assert.Multiple(() =>
        {
            Assert.That(equity.KeepAndBorrow.Payments, Is.EqualTo(356_125.20m), "144 payments on today's loan, 120 of interest only on the line, then 24 of its repayment");
            Assert.That(equity.KeepAndBorrow.StillOwed, Is.EqualTo(264_825.95m), "the line has begun to be paid down");
            Assert.That(equity.KeepAndBorrow.Cost, Is.EqualTo(620_951.15m), "paid and still owed");
            Assert.That(equity.SavedByEquityLoan, Is.EqualTo(-35_999.79m), "the refinance, over the same years, costs 584,951.36");
        });
    }

    [Test]
    public void Analyze_KeepsALinesRate_WhenNoRepaymentRateIsExpected()
    {
        var equity = _service.Analyze(WithALine(yearsKept: 12, repaymentRate: null)).HomeEquity!;

        Assert.Multiple(() =>
        {
            Assert.That(equity.RepaymentRate, Is.EqualTo(8m), "the rate it has");
            Assert.That(equity.RepaymentPayment, Is.EqualTo(418.22m), "$50,000 over 240 months at 8%");
            Assert.That(equity.KeepAndBorrow.Cost, Is.EqualTo(619_950.91m), "paid and still owed");
        });
    }

    [Test]
    public void Analyze_TreatsALoanAsRepayingFromTheStart()
    {
        var equity = _service.Analyze(WithAHomeEquityLoan()).HomeEquity!;

        Assert.Multiple(() =>
        {
            Assert.That(equity.DrawPeriodInMonths, Is.Zero, "a loan has no draw period");
            Assert.That(equity.RepaymentPayment, Is.EqualTo(equity.KeepAndBorrow.EquityLoanPayment), "its payment is the same throughout");
            Assert.That(equity.RepaymentRate, Is.EqualTo(8m), "and its rate");
        });
    }

    [Test]
    public void Analyze_CountsPmiOnBothWays_WhileTheLoanIsAbove80PercentOfTheHome()
    {
        // $300,000 owed on a $360,000 home is 83.3%: the current loan carries its PMI, $120 a month, until it is at 80%.
        var request = WithAHomeEquityLoan(360_000m) with { CurrentMonthlyPmi = 120m };
        var equity = _service.Analyze(request).HomeEquity!;

        Assert.Multiple(() =>
        {
            Assert.That(equity.KeepAndBorrow.MonthlyPayment, Is.GreaterThan(2_598.17m + 119m), "today's PMI is part of keeping the loan");
            Assert.That(equity.CashOutRefinance.MonthlyPayment, Is.GreaterThan(2_098.43m), "and the new loan, at 97% of the home's value, carries its own");
        });
    }

    // The scenarios below were computed independently in Python Decimal (tools/calculator-check): $300,000 at 7% with 25 years to go,
    // refinanced to 6% over 30 years with $6,000 of closing costs, the 6% being the rate with the points and the lender's offer
    // without them 6.25%. The points are a percentage of what is borrowed before any financed costs, paid with the closing costs.
    private static RefinanceRequest WithPoints(decimal points = 1m, decimal rateWithoutPoints = 6.25m) => Request() with
    {
        NewDiscountPoints = new DiscountPointsRequest { Points = points, RateWithoutPoints = rateWithoutPoints },
    };

    [Test]
    public void Analyze_WithoutPoints_HasNoPointsComparison() =>
        Assert.That(_service.Analyze(Request()).Points, Is.Null, "it is only worked out when asked for");

    [Test]
    public void Analyze_PointsOnTheNewLoan_AreWorkedOutAgainstTheRateWithoutThem()
    {
        var points = _service.Analyze(WithPoints()).Points!;

        Assert.Multiple(() =>
        {
            Assert.That(points.Points, Is.EqualTo(1m), "the points asked");
            Assert.That(points.Cost, Is.EqualTo(3_000m), "1% of the $300,000 borrowed");
            Assert.That(points.RateWithoutPoints, Is.EqualTo(6.25m), "the lender's rate without them");
            Assert.That(points.PaymentWithPoints, Is.EqualTo(1_798.65m), "$300,000 at 6% for 30 years");
            Assert.That(points.PaymentWithoutPoints, Is.EqualTo(1_847.15m), "the same loan at 6.25%");
            Assert.That(points.MonthlySaving, Is.EqualTo(48.50m), "the points lower the payment by this");
            Assert.That(points.InterestSaved, Is.EqualTo(17_460.36m), "over the whole loan");
            Assert.That(points.NetSaving, Is.EqualTo(14_460.36m), "less what they cost");
            Assert.That(points.BreakEvenPayment, Is.EqualTo(48), "the payment by which the interest saved covers the $3,000");
        });
    }

    [Test]
    public void Analyze_PointsOnTheNewLoan_ArePaidWithTheClosingCosts_AndSoCountInTheRefinance()
    {
        var response = _service.Analyze(WithPoints());

        Assert.Multiple(() =>
        {
            Assert.That(response.UpfrontCosts, Is.EqualTo(9_000m), "$6,000 of closing costs and $3,000 of points");
            Assert.That(response.LifetimeSavings, Is.EqualTo(-20_415.28m), "$3,000 worse than without them (-17,415.28)");
            Assert.That(response.BreakEvenPaymentNumber, Is.EqualTo(39), "the interest saved takes longer to cover $9,000 (25 payments cover $6,000)");
            Assert.That(response.Points!.BreakEvenDate, Is.EqualTo(response.Refinanced.Payments[47].DueDate), "the due date of the 48th payment");
        });
    }

    [Test]
    public void Analyze_PointsWithFinancedCosts_AreFinancedToo_ButComparedOnLoansOfTheSameSize()
    {
        var response = _service.Analyze(WithPoints() with { FinanceClosingCosts = true });

        Assert.Multiple(() =>
        {
            Assert.That(response.UpfrontCosts, Is.Zero, "everything is in the loan");
            Assert.That(response.Refinanced.MonthlyPayment, Is.EqualTo(1_852.61m), "$309,000 at 6%: the points are borrowed with the rest");
            Assert.That(response.Points!.Cost, Is.EqualTo(3_000m), "1% of the $300,000, not of the loan with the costs added");
            Assert.That(response.Points.PaymentWithPoints, Is.EqualTo(1_834.62m), "the comparison is of $306,000 at 6%, the other costs financed and the points not");
            Assert.That(response.Points.PaymentWithoutPoints, Is.EqualTo(1_884.09m), "against the same $306,000 at 6.25%");
            Assert.That(response.Points.BreakEvenPayment, Is.EqualTo(47), "the payment by which the interest saved covers the points");
        });
    }

    [Test]
    public void Analyze_PointsWithCashOut_AreAPercentageOfWhatIsBorrowedWithIt()
    {
        var points = _service.Analyze(WithPoints(points: 2m, rateWithoutPoints: 6.5m) with { CashOut = 50_000m }).Points!;

        Assert.Multiple(() =>
        {
            Assert.That(points.Cost, Is.EqualTo(7_000m), "2% of the $350,000 borrowed, the cash out included");
            Assert.That(points.PaymentWithPoints, Is.EqualTo(2_098.43m), "$350,000 at 6%");
            Assert.That(points.PaymentWithoutPoints, Is.EqualTo(2_212.24m), "at 6.5%");
            Assert.That(points.InterestSaved, Is.EqualTo(40_972.21m), "over the whole loan");
            Assert.That(points.BreakEvenPayment, Is.EqualTo(48), "the payment by which they pay for themselves");
        });
    }
}
