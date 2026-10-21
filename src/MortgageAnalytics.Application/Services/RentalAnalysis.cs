using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Rental;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// Measures the analyzed home as a rental, on the loan's standard schedule (extra payments are an owner's choice, not
/// the property's): each year's rent, the costs of owning it, and what is left to pay the loan and keep.
/// </summary>
internal static class RentalAnalysis
{
    /// <summary>Each year let out and the first year's measures, or null when the request does not ask.</summary>
    /// <param name="request">The request as made.</param>
    /// <param name="analysis">The request analyzed.</param>
    public static RentalResponse? For(AmortizationRequest request, Analysis analysis)
    {
        if (request.Rental is not { } renting)
            return null;

        var assumptions = new RentalAssumptions(
            renting.MonthlyRent, renting.VacancyPercent, renting.ManagementPercent, renting.MaintenancePercent, renting.RentIncreasePercent);
        var (schedule, costs, loan, buydown) = (analysis.Comparison.Baseline, analysis.Comparison.BaselineCosts, analysis.Rates.Loan, analysis.Rates.Buydown);

        var years = Enumerable.Range(1, Math.Min(30, schedule.NumberOfPayments / 12)).Select(year =>
        {
            var payments = schedule.Payments.Skip((year - 1) * 12).Take(12).ToList();
            var yearCosts = costs.ByYear[year - 1];
            var debtService = payments.Sum(p => p.ScheduledAmount - (buydown?.SubsidyFor(loan, p.PaymentNumber, p.ScheduledAmount) ?? 0m))
                + yearCosts[HousingCostCategory.MortgageInsurance];
            var operating = yearCosts.Total - yearCosts[HousingCostCategory.MortgageInsurance];
            return RentalYear.For(year, assumptions, analysis.Valuation.MarketValueInYear(year - 1), operating, debtService);
        }).ToList();

        var cashInvested = analysis.CashToClose(request);
        var returns = RentalReturns.From(assumptions, years[0], analysis.Purchase.HomePrice, cashInvested);
        return new RentalResponse(
            renting.MonthlyRent, renting.VacancyPercent, renting.ManagementPercent, renting.MaintenancePercent, renting.RentIncreasePercent,
            cashInvested, returns.CapRatePercent, returns.CashOnCashPercent, returns.DebtServiceCoverage, returns.GrossRentMultiplier,
            returns.RentToPricePercent, returns.BreakEvenMonthlyRent,
            [.. years.Select(y => new RentalYearResponse(
                y.Year, y.GrossRent, y.VacancyLoss, y.ManagementFee, y.Maintenance, y.OperatingCosts, y.NetOperatingIncome, y.DebtService, y.CashFlow))]);
    }
}
