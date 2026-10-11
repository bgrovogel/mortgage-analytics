using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Strategies;

/// <summary>
/// The required mortgage payment, month by month: at the loan's rate for that month, re-amortized over the payments
/// left whenever the rate changes (an adjustable rate resetting), with any buydown subsidy paying part of it. Extra
/// principal paid before a reset lowers the payment after it, as lenders re-amortize the smaller balance.
/// </summary>
/// <param name="loan">The mortgage, with any rate changes.</param>
/// <param name="buydown">A temporary buydown on it, or null.</param>
internal sealed class MortgagePayments(LoanTerms loan, TemporaryBuydown? buydown)
{
    private decimal _rate = loan.AnnualInterestRate;
    private decimal _payment = PaymentFormula.MonthlyPayment(loan.Principal, loan.MonthlyRate, loan.TermInMonths);

    /// <summary>The first required payment, before any change.</summary>
    public decimal InitialPayment { get; } = PaymentFormula.MonthlyPayment(loan.Principal, loan.MonthlyRate, loan.TermInMonths);

    /// <summary>What the household pays in month 1: the required payment, less any buydown subsidy.</summary>
    public decimal HouseholdPaymentNow =>
        InitialPayment - (buydown?.SubsidyFor(loan, 1, InitialPayment) ?? 0m);

    /// <summary>
    /// Makes month <paramref name="month"/>'s required payment on <paramref name="balance"/>: the interest at that
    /// month's rate, the principal (all of it in the last month of the term), and what a buydown pays of it.
    /// </summary>
    /// <param name="month">The 1-based month.</param>
    /// <param name="balance">The balance before the payment; more than zero.</param>
    public (decimal Interest, decimal Principal, decimal Subsidy) Pay(int month, decimal balance)
    {
        var rate = loan.AnnualRateFor(month);
        if (rate != _rate)
        {
            _payment = PaymentFormula.MonthlyPayment(balance, rate / 100m / 12m, loan.TermInMonths - month + 1);
            _rate = rate;
        }

        var interest = LoanTerms.MonthlyInterestOn(balance, _rate);
        var principal = month >= loan.TermInMonths ? balance : Math.Min(_payment - interest, balance);
        var subsidy = buydown?.SubsidyFor(loan, month, interest + principal) ?? 0m;
        return (interest, principal, subsidy);
    }
}
