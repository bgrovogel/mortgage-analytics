using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

/// <summary>Shared inputs for the housing-cost tests.</summary>
internal static class HousingCostTestData
{
    /// <summary>The Texas school homestead exemption.</summary>
    public static readonly TaxExemption TexasSchoolHomestead = new(amount: 140_000m);

    /// <summary>A cost period for <paramref name="paymentNumber"/>; the balance only matters for PMI.</summary>
    public static CostPeriod Period(int paymentNumber, decimal openingBalance = 200_000m) => new(paymentNumber, openingBalance);

    /// <summary>A valuation that never changes.</summary>
    public static PropertyValuation Flat(decimal value) => new(value);
}
