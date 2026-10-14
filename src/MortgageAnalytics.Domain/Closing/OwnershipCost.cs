using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Closing;

/// <summary>
/// What a home costs the buyer over the years they keep its loan: the cash to close, every monthly payment, and the
/// balance still owed, which is paid off when the home is sold or the loan refinanced. Choices that lower one at the
/// expense of another (a smaller loan, a lower rate, cheaper early payments) compare on the total.
/// </summary>
/// <param name="Years">The years the loan is kept.</param>
/// <param name="CashToClose">What the buyer brings to closing.</param>
/// <param name="Payments">Every payment the buyer makes in those years: principal, interest and housing costs, less any buydown subsidy.</param>
/// <param name="Balance">What is still owed at the end of them; nothing once the loan is paid off.</param>
public sealed record OwnershipCost(int Years, decimal CashToClose, decimal Payments, decimal Balance)
{
    /// <summary>Everything the buyer pays: the cash to close, the payments and the balance.</summary>
    public decimal Total => CashToClose + Payments + Balance;

    /// <summary>The cost of keeping <paramref name="loan"/> for <paramref name="years"/>, or to its end if that comes first.</summary>
    /// <param name="years">The years the loan is kept.</param>
    /// <param name="cashToClose">What the buyer brings to closing.</param>
    /// <param name="loan">The loan, at its note rate.</param>
    /// <param name="schedule">Its schedule.</param>
    /// <param name="costs">The housing costs charged with each payment.</param>
    /// <param name="buydown">A temporary buydown, whose subsidy pays part of the early payments; otherwise null.</param>
    public static OwnershipCost Over(
        int years, decimal cashToClose, LoanTerms loan, AmortizationSchedule schedule, HousingCostSchedule costs, TemporaryBuydown? buydown)
    {
        var kept = schedule.Payments.Take(years * 12).ToList();
        var payments = kept.Sum(p =>
            p.TotalPaid + costs.Periods[p.PaymentNumber - 1].Total - (buydown?.SubsidyFor(loan, p.PaymentNumber, p.ScheduledAmount) ?? 0m));
        return new OwnershipCost(years, cashToClose, payments, kept[^1].RemainingBalance);
    }
}
