using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Domain.Tests.HousingCosts;

/// <summary>Shared inputs for the housing-cost tests.</summary>
internal static class HousingCostTestData
{
    /// <summary>The Texas school homestead exemption.</summary>
    public static readonly TaxExemption TexasSchoolHomestead = new(amount: 140_000m);

    /// <summary>
    /// A cost period for <paramref name="paymentNumber"/>. Balances only matter for PMI; the original
    /// schedule's balance defaults to the actual balance (a loan with no extra payments).
    /// </summary>
    public static CostPeriod Period(int paymentNumber, decimal openingBalance = 200_000m, decimal? scheduledOpeningBalance = null) =>
        new(paymentNumber, openingBalance, scheduledOpeningBalance ?? openingBalance);

    /// <summary>A valuation that never changes.</summary>
    public static PropertyValuation Flat(decimal value) => new(value);
}
