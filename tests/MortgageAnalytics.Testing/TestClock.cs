using Microsoft.Extensions.Time.Testing;

namespace MortgageAnalytics.Testing;

/// <summary>A fixed "now" for tests, so date-dependent defaults are deterministic.</summary>
public static class TestClock
{
    /// <summary>The instant every test treats as now: 9 October 2026, 15:30 UTC.</summary>
    public static readonly DateTimeOffset Now = new(2026, 10, 9, 15, 30, 0, TimeSpan.Zero);

    /// <summary>The first of the month after <see cref="Now"/>, which is the default first payment date.</summary>
    public static readonly DateOnly FirstOfNextMonth = new(2026, 11, 1);

    /// <summary>Creates a clock frozen at <paramref name="now"/>, or at <see cref="Now"/> when none is given.</summary>
    public static FakeTimeProvider Create(DateTimeOffset? now = null) => new(now ?? Now);
}
