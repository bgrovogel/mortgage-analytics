namespace MortgageAnalytics.Application.Rates;

/// <summary>The average mortgage rates for one week, from Freddie Mac's Primary Mortgage Market Survey.</summary>
/// <param name="AsOf">The week they are for: the Thursday they were published.</param>
/// <param name="ThirtyYearFixed">The 30-year fixed-rate average, as a percentage.</param>
/// <param name="FifteenYearFixed">The 15-year fixed-rate average, as a percentage.</param>
public sealed record AverageRates(DateOnly AsOf, decimal ThirtyYearFixed, decimal FifteenYearFixed);

/// <summary>Where the app gets this week's average rates. It may have none: the source can be unreachable, or switched off.</summary>
public interface IAverageRates
{
    /// <summary>The latest average rates.</summary>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>The rates, or null when they are not available.</returns>
    Task<AverageRates?> GetAsync(CancellationToken cancellationToken);
}
