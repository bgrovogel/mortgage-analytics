using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Validation;
using static MortgageAnalytics.Testing.ReferenceRefinances;

namespace MortgageAnalytics.Application.Tests.Validation;

[TestFixture]
public class RefinanceRequestValidatorTests : ValidatorTestBase<RefinanceRequest, RefinanceRequestValidator>
{
    private static readonly RefinanceRequest Valid = new()
    {
        CurrentBalance = Current.Balance,
        CurrentAnnualInterestRate = Current.AnnualInterestRate,
        RemainingTermInMonths = Current.RemainingTermInMonths,
        NewAnnualInterestRate = ToSixPercentFor30Years.AnnualInterestRate,
        NewTermInMonths = ToSixPercentFor30Years.TermInMonths,
        ClosingCosts = ToSixPercentFor30Years.ClosingCosts,
    };

    [Test]
    public void TheReferenceRefinance_IsValid() => AssertValid(Valid, "a typical refinance passes every rule");

    private static readonly OriginalLoanRequest Original = new() { Amount = 200_000m, TermInMonths = 360, FirstPaymentDate = new DateOnly(2021, 11, 1) };

    [Test]
    public void AnOriginalLoan_TakesThePlaceOfTheBalanceAndPaymentsLeft() =>
        AssertValid(Valid with { CurrentBalance = 0, RemainingTermInMonths = 0, OriginalLoan = Original },
            "the server works out what is owed from the original loan");

    [Test]
    public void AnOriginalLoan_IsCheckedLikeAnyLoan()
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(Valid with { OriginalLoan = Original with { Amount = 0 } }, "OriginalLoan.Amount", "something must have been borrowed");
            AssertInvalid(Valid with { OriginalLoan = Original with { Amount = 100_000_000.01m } }, "OriginalLoan.Amount", "within the loan limit");
            AssertInvalid(Valid with { OriginalLoan = Original with { TermInMonths = 601 } }, "OriginalLoan.TermInMonths", "at most 50 years");
            AssertInvalid(Valid with { OriginalLoan = Original with { FirstPaymentDate = new DateOnly(1899, 12, 1) } }, "OriginalLoan.FirstPaymentDate",
                "within the supported dates");
        });
    }

    [Test]
    public void AnOriginalLoanWithEveryPaymentBehindToday_IsRejected() =>
        AssertInvalid(Valid with { OriginalLoan = Original with { FirstPaymentDate = new DateOnly(1990, 1, 1) } }, "OriginalLoan.FirstPaymentDate",
            "a loan already paid off has nothing to refinance");

    [Test]
    public void Pmi_NeedsAHomeValue_AndStaysInRange()
    {
        Assert.Multiple(() =>
        {
            AssertValid(Valid with { HomeValue = 360_000m, CurrentMonthlyPmi = 120m, NewPmiRate = 0.5m }, "PMI on a home worth $360,000");
            AssertValid(Valid with { HomeValue = null, CurrentMonthlyPmi = 0m }, "no value and no PMI leaves PMI out");
            AssertInvalid(Valid with { HomeValue = null, CurrentMonthlyPmi = 120m }, "HomeValue", "PMI ends at 80% of the value, so it needs one");
            AssertInvalid(Valid with { HomeValue = 0m }, "HomeValue", "a home is worth something");
            AssertInvalid(Valid with { HomeValue = 360_000m, CurrentMonthlyPmi = -0.01m }, "CurrentMonthlyPmi", "PMI is not negative");
            AssertInvalid(Valid with { HomeValue = 360_000m, CurrentMonthlyPmi = 10_000.01m }, "CurrentMonthlyPmi", "within reason");
            AssertInvalid(Valid with { HomeValue = 360_000m, NewPmiRate = 5.01m }, "NewPmiRate", "the same limit as the calculator's");
        });
    }

    [Test]
    public void ZeroRatesAndNoClosingCosts_AreValid() =>
        AssertValid(Valid with { CurrentAnnualInterestRate = 0, NewAnnualInterestRate = 0, ClosingCosts = 0 }, "0% loans and free refinances are edge cases, not errors");

    [TestCase(0, TestName = "a zero balance")]
    [TestCase(-1, TestName = "a negative balance")]
    [TestCase(100_000_000.01, TestName = "a balance over the limit")]
    [TestCase(1_000.005, TestName = "fractions of a cent")]
    public void AnUnusableBalance_IsRejected(decimal balance) =>
        AssertInvalid(Valid with { CurrentBalance = balance }, "CurrentBalance", "there must be a real balance to refinance");

    [TestCase(-0.1)]
    [TestCase(30.01)]
    public void RatesOutsideTheSupportedRange_AreRejected(decimal rate)
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(Valid with { CurrentAnnualInterestRate = rate }, "CurrentAnnualInterestRate", "the current rate has the calculator's limits");
            AssertInvalid(Valid with { NewAnnualInterestRate = rate }, "NewAnnualInterestRate", "and so does the new one");
        });
    }

    [TestCase(0)]
    [TestCase(601)]
    public void TermsOutsideTheSupportedRange_AreRejected(int months)
    {
        Assert.Multiple(() =>
        {
            AssertInvalid(Valid with { RemainingTermInMonths = months }, "RemainingTermInMonths", "1 to 600 payments left");
            AssertInvalid(Valid with { NewTermInMonths = months }, "NewTermInMonths", "a new term of 1 to 600 months");
        });
    }

    [Test]
    public void NegativeClosingCosts_AreRejected() =>
        AssertInvalid(Valid with { ClosingCosts = -1 }, "ClosingCosts", "costs cannot be negative");

    [Test]
    public void FinancedClosingCosts_CannotPushTheNewLoanOverTheLimit() =>
        AssertErrorMessage(
            Valid with { CurrentBalance = 99_999_000m, ClosingCosts = 5_000m, FinanceClosingCosts = true },
            "ClosingCosts",
            "The new loan (balance plus financed closing costs) cannot exceed 100,000,000.",
            "the new loan amount includes the financed costs");

    [Test]
    public void NegativeCashOut_IsRejected() =>
        AssertInvalid(Valid with { CashOut = -1 }, "CashOut", "cash out cannot be negative");

    [Test]
    public void CashOut_CannotPushTheNewLoanOverTheLimit() =>
        AssertErrorMessage(
            Valid with { CurrentBalance = 99_999_000m, CashOut = 5_000m },
            "CashOut",
            "The new loan (balance plus cash out and any financed closing costs) cannot exceed 100,000,000.",
            "the new loan borrows the cash too");

    [Test]
    public void CashOut_WithFinancedClosingCosts_CannotPushTheNewLoanOverTheLimit() =>
        AssertErrorMessage(
            Valid with { CurrentBalance = 99_999_000m, CashOut = 500m, ClosingCosts = 1_000m, FinanceClosingCosts = true },
            "CashOut",
            "The new loan (balance plus cash out and any financed closing costs) cannot exceed 100,000,000.",
            "balance, cash and the financed costs are all borrowed");

    [Test]
    public void CashOut_WithClosingCostsPaidUpFront_ItsLimitIgnoresThem() =>
        AssertNoErrorFor(
            Valid with { CurrentBalance = 99_999_000m, CashOut = 500m, ClosingCosts = 1_000m, FinanceClosingCosts = false },
            "CashOut", "costs paid at closing are not borrowed");

    [Test]
    public void CashOut_OnAnOriginalLoan_IsMeasuredFromWhatWasFirstBorrowed() =>
        AssertErrorMessage(
            Valid with { OriginalLoan = Original with { Amount = 99_999_900m }, CashOut = 200m },
            "CashOut",
            "The new loan (balance plus cash out and any financed closing costs) cannot exceed 100,000,000.",
            "what is owed is at most what was first borrowed, so that bounds the new loan");

    [Test]
    public void CashOutWithinTheLimit_IsAccepted() =>
        AssertValid(Valid with { CashOut = 50_000m }, "a cash-out refinance is an ordinary request");

    [Test]
    public void ClosingCostsPaidUpFront_DoNotCountTowardTheLoanLimit() =>
        AssertNoErrorFor(Valid with { CurrentBalance = 99_999_000m, ClosingCosts = 5_000m }, "ClosingCosts", "cash at closing is not borrowed");

    [Test]
    public void ANextPaymentDateFarOutsideTheCalendar_IsRejected() =>
        AssertInvalid(Valid with { NextPaymentDate = new DateOnly(1800, 1, 1) }, "NextPaymentDate", "dates must stay within the supported range");

    [Test]
    public void AdjustableRatesAndABuydown_AreChecked()
    {
        var arm = new AdjustableRateRequest { InitialFixedMonths = 24, AdjustmentIntervalMonths = 12, ExpectedRate = 9m, InitialCap = 2m, PeriodicCap = 2m, LifetimeCap = 5m };
        var buydown = new TemporaryBuydownRequest { YearlyReductions = [2m, 1m] };

        Assert.Multiple(() =>
        {
            AssertValid(Valid with { CurrentAdjustableRate = arm, NewAdjustableRate = arm }, "both loans can adjust");
            AssertValid(Valid with { NewBuydown = buydown }, "the new loan can be bought down");
            AssertInvalid(Valid with { CurrentAdjustableRate = arm with { InitialFixedMonths = 300 } }, "CurrentAdjustableRate.InitialFixedMonths", "the reset must come before the loan ends");
            AssertInvalid(Valid with { NewAdjustableRate = arm with { LifetimeCap = 11m } }, "NewAdjustableRate.LifetimeCap", "caps of at most 10 points");
            AssertInvalid(Valid with { NewAdjustableRate = arm, NewBuydown = buydown }, "NewAdjustableRate", "the new loan is one or the other");
        });
    }

    [Test]
    public void PointsOnTheNewLoan_AreWithinWhatALenderOffers()
    {
        var points = new DiscountPointsRequest { Points = 1m, RateWithoutPoints = 6.25m };
        var arm = new AdjustableRateRequest { InitialFixedMonths = 24, AdjustmentIntervalMonths = 12, ExpectedRate = 9m, InitialCap = 2m, PeriodicCap = 2m, LifetimeCap = 5m };

        Assert.Multiple(() =>
        {
            AssertValid(Valid with { NewDiscountPoints = points }, "one point against the rate without it");
            AssertValid(Valid with { NewDiscountPoints = points with { Points = 5m } }, "five points are the most");
            AssertInvalid(Valid with { NewDiscountPoints = points with { Points = 0m } }, "NewDiscountPoints.Points", "no points is no offer");
            AssertInvalid(Valid with { NewDiscountPoints = points with { Points = 5.001m } }, "NewDiscountPoints.Points", "more than five is not offered");
            AssertInvalid(Valid with { NewDiscountPoints = points with { Points = 1.0005m } }, "NewDiscountPoints.Points", "thousandths of a point at most");
            AssertInvalid(Valid with { NewDiscountPoints = points with { RateWithoutPoints = 6m } }, "NewDiscountPoints.RateWithoutPoints", "the rate without points is higher than the rate with them");
            AssertInvalid(Valid with { NewDiscountPoints = points with { RateWithoutPoints = 30.01m } }, "NewDiscountPoints.RateWithoutPoints", "and a rate a loan may have");
            AssertInvalid(Valid with { NewDiscountPoints = points, NewAdjustableRate = arm }, "NewDiscountPoints", "points are compared on a fixed rate");
            AssertInvalid(Valid with { NewDiscountPoints = points, NewBuydown = new TemporaryBuydownRequest { YearlyReductions = [2m, 1m] } }, "NewDiscountPoints", "and not on a buydown");
        });
    }

    /// <summary>The validator on the test clock: today is 9 October 2026.</summary>
    private static RefinanceRequestValidator OnTestClock() => new(TestClock.Create());

    [Test]
    public void AnOriginalLoanWhoseLastPaymentIsToday_StillHasOneLeft()
    {
        var request = Valid with { OriginalLoan = Original with { TermInMonths = 1, FirstPaymentDate = new DateOnly(2026, 10, 9) } };

        Assert.That(OnTestClock().Validate(request).Errors, Is.Empty, "a payment due today has not been made yet");
    }

    [Test]
    public void AnOriginalLoanWhoseLastPaymentWasLastMonth_IsPaidOff()
    {
        var request = Valid with { OriginalLoan = Original with { TermInMonths = 1, FirstPaymentDate = new DateOnly(2026, 9, 9) } };

        Assert.That(OnTestClock().Validate(request).Errors.Select(e => e.PropertyName), Has.Member("OriginalLoan.FirstPaymentDate"),
            "its only payment was due a month ago");
    }

    [TestCase(600, TestName = "LongestTerm_PaidOff")]
    [TestCase(1, TestName = "ShortestTerm_PaidOff")]
    public void AnOriginalLoanPaidOffLongAgo_IsRejected_WhateverItsTerm(int term)
    {
        AssertInvalid(Valid with { OriginalLoan = Original with { TermInMonths = term, FirstPaymentDate = new DateOnly(1900, 1, 1) } },
            "OriginalLoan.FirstPaymentDate", "every payment, even of the longest loan, is behind today");
    }

    [Test]
    public void AnOriginalLoanWithAnImpossibleTerm_IsRejected_RatherThanThrowing()
    {
        AssertInvalid(Valid with { OriginalLoan = Original with { TermInMonths = int.MaxValue } }, "OriginalLoan.TermInMonths",
            "the paid-off check is skipped for a term that is already wrong");
    }

    [Test]
    public void ACurrentArm_IsCheckedAgainstTheOriginalLoansTerm_WhenThereIsOne()
    {
        var arm = new AdjustableRateRequest { InitialFixedMonths = 84, ExpectedRate = 7.5m };

        AssertValid(Valid with { CurrentBalance = 0, RemainingTermInMonths = 0, OriginalLoan = Original, CurrentAdjustableRate = arm },
            "with an original loan, the fixed period is measured against its 360 payments");
    }

    [Test]
    public void ANewBuydown_IsChecked()
    {
        AssertInvalid(Valid with { NewBuydown = new TemporaryBuydownRequest { YearlyReductions = [] } }, "NewBuydown.YearlyReductions",
            "a buydown needs at least one year");
    }

    [Test]
    public void FinancedClosingCosts_OnAnOriginalLoan_CountTheOriginalAmount()
    {
        var request = Valid with
        {
            CurrentBalance = 0, RemainingTermInMonths = 0, ClosingCosts = 1m, FinanceClosingCosts = true,
            OriginalLoan = Original with { Amount = 100_000_000m },
        };

        AssertInvalid(request, "ClosingCosts", "what was first borrowed bounds what is owed, so $100 million plus $1 is over the limit");
    }

    [Test]
    public void ArmCapsAndABuydownOfOneYear_AreChecked()
    {
        var arm = new AdjustableRateRequest { InitialFixedMonths = 60, ExpectedRate = 7m };
        Assert.Multiple(() =>
        {
            AssertInvalid(Valid with { NewAdjustableRate = arm with { InitialCap = -1m } }, "NewAdjustableRate.InitialCap", "the first reset's cap");
            AssertInvalid(Valid with { NewAdjustableRate = arm with { PeriodicCap = -1m } }, "NewAdjustableRate.PeriodicCap", "the later resets' cap");
            AssertValid(Valid with { NewBuydown = new TemporaryBuydownRequest { YearlyReductions = [1.00000m] } },
                "a one-year buydown, its reduction written with trailing zeros");
        });
    }

    private static readonly HomeEquityLoanRequest Equity = new() { AnnualInterestRate = 8m, TermInMonths = 180, YearsKept = 7 };

    [Test]
    public void AHomeEquityLoan_NeedsCashToBeTakenOut_AndIsOtherwiseValid()
    {
        AssertValid(Valid with { CashOut = 50_000m, HomeEquityLoan = Equity }, "the cash taken out is what it lends");
        AssertErrorMessage(Valid with { HomeEquityLoan = Equity }, "HomeEquityLoan", "Enter the cash to take out to compare it with a home-equity loan.",
            "without cash there is nothing to borrow");
    }

    [Test]
    public void AHomeEquityLoan_IsCheckedLikeAnyLoan()
    {
        var withCash = Valid with { CashOut = 50_000m };

        Assert.Multiple(() =>
        {
            AssertInvalid(withCash with { HomeEquityLoan = Equity with { AnnualInterestRate = -0.01m } }, "HomeEquityLoan.AnnualInterestRate", "a rate is not negative");
            AssertInvalid(withCash with { HomeEquityLoan = Equity with { AnnualInterestRate = 30.01m } }, "HomeEquityLoan.AnnualInterestRate", "and has a ceiling");
            AssertInvalid(withCash with { HomeEquityLoan = Equity with { TermInMonths = 0 } }, "HomeEquityLoan.TermInMonths", "it takes at least a month");
            AssertInvalid(withCash with { HomeEquityLoan = Equity with { TermInMonths = 361 } }, "HomeEquityLoan.TermInMonths", "and at most 30 years");
            AssertInvalid(withCash with { HomeEquityLoan = Equity with { YearsKept = 0 } }, "HomeEquityLoan.YearsKept", "at least a year is kept");
            AssertInvalid(withCash with { HomeEquityLoan = Equity with { YearsKept = 31 } }, "HomeEquityLoan.YearsKept", "and at most 30");
        });
    }

    [Test]
    public void ALineOfCredit_NeedsADrawPeriodAndARepaymentRateWithinLimits()
    {
        var line = Valid with { CashOut = 50_000m, HomeEquityLoan = Equity with { DrawPeriodInMonths = 120, RepaymentRate = 9m } };

        Assert.Multiple(() =>
        {
            AssertValid(line, "ten years of interest only, then repaid at 9%");
            AssertValid(Valid with { CashOut = 50_000m, HomeEquityLoan = Equity with { DrawPeriodInMonths = 120 } }, "no expected repayment rate keeps the line's rate");
            AssertValid(Valid with { CashOut = 50_000m, HomeEquityLoan = Equity with { DrawPeriodInMonths = 360, RepaymentRate = 0m } }, "30 years drawn, and a 0% rate is allowed");
            AssertInvalid(line with { HomeEquityLoan = line.HomeEquityLoan! with { DrawPeriodInMonths = -1 } }, "HomeEquityLoan.DrawPeriodInMonths", "a draw period is not negative");
            AssertInvalid(line with { HomeEquityLoan = line.HomeEquityLoan! with { DrawPeriodInMonths = 361 } }, "HomeEquityLoan.DrawPeriodInMonths", "and is at most 30 years");
            AssertInvalid(line with { HomeEquityLoan = line.HomeEquityLoan! with { RepaymentRate = -0.01m } }, "HomeEquityLoan.RepaymentRate", "a rate is not negative");
            AssertInvalid(line with { HomeEquityLoan = line.HomeEquityLoan! with { RepaymentRate = 30.01m } }, "HomeEquityLoan.RepaymentRate", "and has a ceiling");
        });
    }
}
