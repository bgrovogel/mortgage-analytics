namespace MortgageAnalytics.Application.Contracts;

/// <summary>This week's average mortgage rates, as a starting point for a rate that is not known yet.</summary>
/// <param name="AsOf">The week they are for.</param>
/// <param name="ThirtyYearFixed">The 30-year fixed-rate average, as a percentage.</param>
/// <param name="FifteenYearFixed">The 15-year fixed-rate average, as a percentage.</param>
/// <param name="Source">Who publishes them.</param>
public sealed record AverageRatesResponse(DateOnly AsOf, decimal ThirtyYearFixed, decimal FifteenYearFixed, string Source);
