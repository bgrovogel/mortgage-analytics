using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// The figures in a Loan Estimate's comparison box, from the standard schedule (an estimate leaves extra payments
/// out): what the first five years cost, and the total interest as a percentage of the loan.
/// </summary>
internal static class LoanEstimateFigures
{
    /// <summary>Sixty payments: five years.</summary>
    private const int FirstPayments = 60;

    /// <summary>
    /// The first 60 payments with their mortgage insurance, plus the lender's loan costs (not the other fees, which
    /// are government charges and services the borrower may shop for), and the principal those payments pay off.
    /// </summary>
    public static InFiveYearsResponse InFiveYears(AmortizationResponse response)
    {
        var payments = response.Baseline.Payments.Take(FirstPayments).ToList();
        var paid = payments.Sum(p => p.ScheduledPayment + p.Costs.MortgageInsurance) + (response.CashToClose?.LoanCosts ?? 0m);
        return new InFiveYearsResponse(paid, payments.Sum(p => p.Principal));
    }

    /// <summary>The interest over the whole loan as a percentage of the amount borrowed, to a thousandth; null when nothing is borrowed.</summary>
    public static decimal? TotalInterestPercentage(AmortizationResponse response)
    {
        var borrowed = response.Program?.LoanAmount ?? response.Purchase.LoanAmount;
        return borrowed <= 0m ? null : Math.Round(response.Baseline.TotalInterest / borrowed * 100m, 3, MidpointRounding.AwayFromZero);
    }
}
