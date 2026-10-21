using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.RentOrBuy;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// Weighs buying the analyzed home against renting a similar one, on the loan's standard schedule (extra payments are
/// an investment choice, like the renter's), with what buying takes to close as the renter's head start.
/// </summary>
internal static class RentOrBuyAnalysis
{
    /// <summary>Each year compared, or null when the request does not ask.</summary>
    /// <param name="request">The request as made.</param>
    /// <param name="analysis">The request analyzed.</param>
    public static RentOrBuyResponse? For(AmortizationRequest request, Analysis analysis)
    {
        if (request.RentOrBuy is not { } renting)
            return null;

        var cashToClose = request.ToClosingCosts() is { } closing
            ? AmortizationMapper.CashToCloseFor(closing, analysis.Purchase, analysis.Comparison, analysis.Rates).Total
            : analysis.Purchase.DownPayment;
        var assumptions = new RentOrBuyAssumptions(
            renting.MonthlyRent, renting.RentIncreasePercent, renting.InvestmentReturnPercent, renting.MaintenancePercent, renting.SellingCostPercent);
        var tax = renting.OwnerTaxes is { } owner ? new OwnerTaxProfile(StrategyMapper.ToDomain(owner.FilingStatus), owner.MarginalTaxRatePercent, owner.OtherStateAndLocalTaxes, owner.OtherItemizedDeductions) : null;
        var years = RentOrBuyComparison.Years(
            assumptions, cashToClose, analysis.Rates.Loan, analysis.Comparison.Baseline, analysis.Comparison.BaselineCosts, analysis.Rates.Buydown,
            analysis.Valuation, tax);

        return new RentOrBuyResponse(
            renting.MonthlyRent, renting.RentIncreasePercent, renting.InvestmentReturnPercent, renting.MaintenancePercent, renting.SellingCostPercent,
            cashToClose, RentOrBuyComparison.BreakEvenYear(years),
            [.. years.Select(y => new RentOrBuyYearResponse(
                y.Year, y.OwnershipCost, y.Rent, y.HomeEquity, y.BuyerInvestments, y.BuyerNetWorth, y.RenterNetWorth, y.Advantage, y.TaxSaved))],
            tax is not null);
    }
}
