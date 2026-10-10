namespace MortgageAnalytics.Application.Services;

/// <summary>Date defaults shared by the use cases, so they all agree on what "next month" means.</summary>
public static class ClockExtensions
{
    /// <summary>
    /// Returns the first day of the month after today, in the server's local time zone. Using UTC
    /// would jump a month early on the last evening of a month for US users.
    /// </summary>
    /// <param name="clock">The clock to read today from.</param>
    /// <returns>The first of next month: the default date of a first (or next) payment.</returns>
    public static DateOnly FirstOfNextMonth(this TimeProvider clock)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        return new DateOnly(today.Year, today.Month, 1).AddMonths(1);
    }
}
