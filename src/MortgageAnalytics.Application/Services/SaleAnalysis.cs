using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Selling;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// What selling the analyzed home would leave in hand at the end of each year of the loan: its value then, less what is
/// owed on the plan (with its extra payments), the costs of selling and the tax on any gain.
/// </summary>
internal static class SaleAnalysis
{
    /// <summary>Each year's sale, or null when the request does not ask.</summary>
    /// <param name="request">The request as made.</param>
    /// <param name="analysis">The request analyzed.</param>
    public static SaleResponse? For(AmortizationRequest request, Analysis analysis)
    {
        if (request.Sale is not { } sale)
            return null;

        var primary = request.Occupancy == OccupancyType.PrimaryResidence;
        var assumptions = new SaleAssumptions(sale.SellingCostPercent, StrategyMapper.ToDomain(sale.FilingStatus), sale.GainsTaxRatePercent, primary);

        // Owed at each year's end on the plan; nothing once it is paid off. The years run as far as the standard schedule.
        var accelerated = analysis.Comparison.Accelerated.Payments;
        var years = Math.Min(30, analysis.Comparison.Baseline.NumberOfPayments / 12);
        var balances = Enumerable.Range(1, years).Select(year => accelerated.ElementAtOrDefault((year * 12) - 1)?.RemainingBalance ?? 0m).ToList();

        IReadOnlyList<SaleYearResponse> Respond(PropertyValuation valuation) =>
            [.. HomeSale.Years(request.HomePrice, valuation, balances, assumptions)
                .Select(y => new SaleYearResponse(y.Year, y.HomeValue, y.LoanBalance, y.SellingCosts, y.Gain, y.TaxFreeGain, y.TaxOnGain, y.NetProceeds))];

        // The same sale with the home's value moving by other yearly rates: what is owed does not depend on what the home is worth.
        var scenarios = (sale.ValueChangesPercent ?? [])
            .Select(change => new SaleScenarioResponse(change, Respond(new PropertyValuation(request.HomePrice, change))))
            .ToList();
        return new SaleResponse(
            sale.SellingCostPercent, sale.GainsTaxRatePercent, HomeSale.ExclusionFor(assumptions.FilingStatus, primary),
            Respond(analysis.Valuation), scenarios);
    }
}
