using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Refinancing;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// Cash from the home's equity, two ways. Keep the current loan and borrow the cash as a home-equity loan beside it, or
/// refinance with the cash added: one new loan, replacing the one that is kept in the first way. Each is costed over the
/// years kept as everything paid in them (PMI included) plus what is still owed after, plus what is paid at closing, so a
/// way that borrows more cheaply for longer is not mistaken for one that costs less.
/// </summary>
internal static class HomeEquityComparison
{
    private static readonly AmortizationCalculator Calculator = new();

    /// <summary>The most a lender allows to be borrowed against the home, as a share of its value (the cash-out limit, here for both ways).</summary>
    private const decimal MaxCombinedLoanToValue = RefinanceAnalysis.MaxCashOutLoanToValue;

    /// <summary>The two ways, or null when the request does not ask for a home-equity loan.</summary>
    /// <param name="request">The request as made.</param>
    /// <param name="analysis">The refinance, analyzed: the current loan and the cash-out refinance are priced as it prices them.</param>
    public static HomeEquityResponse? For(RefinanceRequest request, RefinanceAnalysis analysis)
    {
        if (request.HomeEquityLoan is not { } equity)
            return null;

        var months = equity.YearsKept * 12;
        var amount = request.CashOut;
        var firstPayment = analysis.Current.Payments[0].DueDate;
        var schedule = Calculator.Generate(new LoanTerms(amount, equity.AnnualInterestRate, equity.TermInMonths, firstPayment), ExtraPaymentPlan.None, RecastPolicy.Never);

        var currentPayments = Paid(analysis.Current, analysis.CurrentPmi.ChargesOn(analysis.Current), months);
        var equityPayments = Paid(schedule, [], months);
        var keep = new HomeEquityOptionResponse(
            analysis.Current.InitialMonthlyPayment + analysis.CurrentPmi.FirstOn(analysis.Current) + schedule.InitialMonthlyPayment,
            schedule.InitialMonthlyPayment,
            currentPayments + equityPayments,
            OwedAfter(analysis.Current, months) + OwedAfter(schedule, months),
            0m,
            0m);
        var refinance = new HomeEquityOptionResponse(
            analysis.Refinanced.InitialMonthlyPayment + analysis.NewPmi.FirstOn(analysis.Refinanced),
            0m,
            Paid(analysis.Refinanced, analysis.NewPmi.ChargesOn(analysis.Refinanced), months),
            OwedAfter(analysis.Refinanced, months),
            analysis.CashAtClosing,
            0m);
        keep = keep with { Cost = keep.Payments + keep.StillOwed + keep.UpfrontCosts };
        refinance = refinance with { Cost = refinance.Payments + refinance.StillOwed + refinance.UpfrontCosts };

        var owed = analysis.Current.Payments[0].OpeningBalance;
        var home = request.HomeValue;
        return new HomeEquityResponse(
            amount, equity.AnnualInterestRate, equity.TermInMonths, equity.YearsKept,
            home is { } value ? Math.Max(0m, Math.Round(value * MaxCombinedLoanToValue - owed, 2)) : null,
            home is { } v ? Math.Round((owed + amount) / v * 100m, 2) : null,
            home is { } h && owed + amount > h * MaxCombinedLoanToValue,
            keep, refinance, refinance.Cost - keep.Cost);
    }

    /// <summary>What is paid in the first <paramref name="months"/> payments: principal and interest, extra principal, and the PMI charged with them.</summary>
    private static decimal Paid(AmortizationSchedule schedule, IEnumerable<decimal> pmi, int months) =>
        schedule.Payments.Take(months).Sum(p => p.TotalPaid) + pmi.Take(months).Sum();

    /// <summary>What is still owed after <paramref name="months"/> payments; nothing once the loan is paid off.</summary>
    private static decimal OwedAfter(AmortizationSchedule schedule, int months) =>
        schedule.Payments.Count <= months ? 0m : schedule.Payments[months - 1].RemainingBalance;
}
