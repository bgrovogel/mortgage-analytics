using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Refinancing;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// A debt the cash out would pay off, against keeping it. Keeping it is the debt's own schedule: a fixed payment each month
/// until it is gone. Paying it off adds its balance to the new loan, which costs what that loan costs more than the same
/// refinance with the balance out of the cash. Each is costed over the years kept as everything paid in them plus what is still
/// owed after, so a debt spread over thirty years is not mistaken for a cheaper one because its monthly payment is smaller.
/// </summary>
internal static class DebtPayoffComparison
{
    /// <summary>The most months a debt's schedule runs: a safeguard; the validator requires a payment that shrinks the debt.</summary>
    private const int MaxMonths = 1_200;

    /// <summary>Weighs paying the debt off with the cash against keeping it.</summary>
    /// <param name="debt">The debt.</param>
    /// <param name="refinance">The refinance as asked, with the debt in the cash out.</param>
    /// <param name="withoutDebt">The same refinance with the debt's balance out of the cash out.</param>
    public static DebtPayoffResponse For(DebtPayoffRequest debt, RefinanceAnalysis refinance, RefinanceAnalysis withoutDebt)
    {
        var months = debt.YearsKept * 12;
        var schedule = Schedule(debt);

        var keepPaid = schedule.Take(months).Sum(month => month.Payment);
        var keepOwed = schedule.Count > months ? schedule[months - 1].Balance : 0m;

        var extraPaid = HomeEquityComparison.Paid(refinance.Refinanced, refinance.NewPmi.ChargesOn(refinance.Refinanced), months)
            - HomeEquityComparison.Paid(withoutDebt.Refinanced, withoutDebt.NewPmi.ChargesOn(withoutDebt.Refinanced), months);
        var extraOwed = HomeEquityComparison.OwedAfter(refinance.Refinanced, months) - HomeEquityComparison.OwedAfter(withoutDebt.Refinanced, months);
        var extraMonthly = (refinance.Refinanced.InitialMonthlyPayment + refinance.NewPmi.FirstOn(refinance.Refinanced))
            - (withoutDebt.Refinanced.InitialMonthlyPayment + withoutDebt.NewPmi.FirstOn(withoutDebt.Refinanced));

        var keep = new DebtPayoffOptionResponse(debt.MonthlyPayment, keepPaid, keepOwed, keepPaid + keepOwed);
        var payOff = new DebtPayoffOptionResponse(extraMonthly, extraPaid, extraOwed, extraPaid + extraOwed);
        return new DebtPayoffResponse(
            debt.Balance, debt.AnnualInterestRate, debt.MonthlyPayment, debt.YearsKept, schedule.Count, schedule.Sum(month => month.Interest),
            keep, payOff, keep.Cost - payOff.Cost, debt.MonthlyPayment - extraMonthly);
    }

    /// <summary>Each month until the debt is paid: interest on what is owed to the cent, the payment (the last is smaller), and what is owed after.</summary>
    private static List<(decimal Payment, decimal Interest, decimal Balance)> Schedule(DebtPayoffRequest debt)
    {
        var months = new List<(decimal, decimal, decimal)>();
        var balance = debt.Balance;
        while (balance > 0 && months.Count < MaxMonths)
        {
            var interest = LoanTerms.MonthlyInterestOn(balance, debt.AnnualInterestRate);
            var payment = Math.Min(debt.MonthlyPayment, balance + interest);
            balance -= payment - interest;
            months.Add((payment, interest, balance));
        }

        return months;
    }
}
