using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Closing;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// A second loan against paying PMI. Each way is the request analyzed again, so it is priced as the calculator prices any
/// loan: the request as made (one loan, with PMI if it needs it), and the same purchase with the second loan taking part of
/// what is borrowed, so the first loan is smaller. Both are costed over the years the loans are kept, on their standard
/// schedules, the cash to close the same, as the buyer's own money in both is the down payment and the closing costs.
/// </summary>
internal static class SecondLoanComparison
{
    private static readonly AmortizationCalculator Calculator = new();

    /// <summary>The two ways, or null when the request does not ask.</summary>
    /// <param name="request">The request as made.</param>
    /// <param name="analysis">The request analyzed.</param>
    /// <param name="analyze">Analyzes another request.</param>
    public static SecondLoanResponse? For(AmortizationRequest request, Analysis analysis, Func<AmortizationRequest, Analysis> analyze)
    {
        if (request.SecondLoan is not { } second)
            return null;

        // Both ways start from the loan without extra payments or a buydown, which are choices of their own.
        var plain = request with { ExtraPayments = null, Buydown = null, SecondLoan = null };
        var asMade = analyze(plain);
        var withSecond = analyze(plain with { DownPayment = request.DownPayment + second.Amount });

        var secondSchedule = Calculator.Generate(
            new LoanTerms(second.Amount, second.AnnualInterestRate, second.TermInMonths, asMade.Rates.Loan.FirstPaymentDate),
            ExtraPaymentPlan.None, RecastPolicy.Never);

        var without = Option(plain, asMade, 0m, null, second.YearsKept);
        var with = Option(plain, withSecond, second.Amount, secondSchedule, second.YearsKept);
        return new SecondLoanResponse(second.Amount, second.AnnualInterestRate, second.TermInMonths, second.YearsKept, without, with, without.Cost - with.Cost);
    }

    private static SecondLoanOptionResponse Option(
        AmortizationRequest request, Analysis a, decimal secondAmount, AmortizationSchedule? secondSchedule, int years)
    {
        // The down payment is the buyer's own, whatever is borrowed behind the first loan: the second loan's amount is not cash at closing.
        var cash = a.CashToClose(request with { DownPayment = a.Purchase.DownPayment }) - secondAmount;
        var cost = OwnershipCost.Over(years, cash, a.Rates.Loan, a.Comparison.Baseline, a.Comparison.BaselineCosts, null);

        var secondKept = secondSchedule?.Payments.Take(years * 12).ToList() ?? [];
        var secondPayments = secondKept.Sum(p => p.TotalPaid);
        var secondBalance = secondKept.Count == 0 ? 0m : secondKept[^1].RemainingBalance;
        var secondPayment = secondSchedule?.Payments[0].ScheduledAmount ?? 0m;

        var first = a.Comparison.Baseline.Payments[0];
        var costs = a.Comparison.BaselineCosts.Periods[0];
        var total = new OwnershipCost(years, cash, cost.Payments + secondPayments, cost.Balance + secondBalance);
        return new SecondLoanOptionResponse(
            a.Rates.Loan.Principal, secondAmount, first.ScheduledAmount, secondPayment, costs[HousingCostCategory.MortgageInsurance],
            first.TotalPaid + costs.Total + secondPayment, cash, total.Payments, total.Balance, total.Total);
    }
}
