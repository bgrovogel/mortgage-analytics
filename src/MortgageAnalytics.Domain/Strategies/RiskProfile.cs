namespace MortgageAnalytics.Domain.Strategies;

/// <summary>How much of the market's expected return the user is willing to count on.</summary>
public enum RiskProfile
{
    /// <summary>Counts on 4 points less than the expected return.</summary>
    Conservative = 0,

    /// <summary>Counts on 2 points less than the expected return.</summary>
    Balanced = 1,

    /// <summary>Counts on the full expected return.</summary>
    Aggressive = 2,
}

/// <summary>What each <see cref="RiskProfile"/> means in numbers.</summary>
public static class RiskProfiles
{
    /// <summary>
    /// Percentage points taken off the expected market return before it is compared with the mortgage rate.
    /// Paying down the mortgage earns its rate with certainty; the market's return is only an average, never
    /// guaranteed, so it has to beat the mortgage by a margin before it is worth the risk.
    /// </summary>
    /// <param name="profile">The user's profile.</param>
    public static decimal MarginInPoints(this RiskProfile profile) => profile switch
    {
        RiskProfile.Conservative => 4m,
        RiskProfile.Balanced => 2m,
        RiskProfile.Aggressive => 0m,
        _ => throw new DomainValidationException($"Unknown risk profile {profile}."),
    };
}
