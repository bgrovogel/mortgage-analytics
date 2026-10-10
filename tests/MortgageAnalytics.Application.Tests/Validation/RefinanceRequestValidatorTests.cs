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
    public void ClosingCostsPaidUpFront_DoNotCountTowardTheLoanLimit() =>
        AssertNoErrorFor(Valid with { CurrentBalance = 99_999_000m, ClosingCosts = 5_000m }, "ClosingCosts", "cash at closing is not borrowed");

    [Test]
    public void ANextPaymentDateFarOutsideTheCalendar_IsRejected() =>
        AssertInvalid(Valid with { NextPaymentDate = new DateOnly(1800, 1, 1) }, "NextPaymentDate", "dates must stay within the supported range");
}
