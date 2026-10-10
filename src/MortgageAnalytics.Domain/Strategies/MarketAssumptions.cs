namespace MortgageAnalytics.Domain.Strategies;

/// <summary>What the market is assumed to do, and how much of that the user is willing to count on.</summary>
public sealed record MarketAssumptions
{
    /// <summary>Creates the assumptions, rejecting any value outside the supported range.</summary>
    /// <param name="expectedAnnualReturn">The average yearly return of an S&amp;P 500 index fund, dividends included, as a percentage.</param>
    /// <param name="inflationRate">Yearly inflation, as a percentage; used to show results in today's dollars.</param>
    /// <param name="riskProfile">How much of the expected return to count on.</param>
    /// <exception cref="DomainValidationException">A value is out of range.</exception>
    public MarketAssumptions(decimal expectedAnnualReturn, decimal inflationRate, RiskProfile riskProfile)
    {
        if (expectedAnnualReturn is < -10 or > 30)
            throw new DomainValidationException("The expected market return must be between -10% and 30%.");
        if (inflationRate is < -5 or > 20)
            throw new DomainValidationException("Inflation must be between -5% and 20%.");
        if (!Enum.IsDefined(riskProfile))
            throw new DomainValidationException($"Unknown risk profile {riskProfile}.");

        ExpectedAnnualReturn = expectedAnnualReturn;
        InflationRate = inflationRate;
        RiskProfile = riskProfile;
    }

    /// <summary>The average yearly market return, as a percentage. An average, never a guarantee.</summary>
    public decimal ExpectedAnnualReturn { get; }

    /// <summary>Yearly inflation, as a percentage.</summary>
    public decimal InflationRate { get; }

    /// <summary>How much of the expected return to count on.</summary>
    public RiskProfile RiskProfile { get; }

    /// <summary>The expected return minus the risk profile's margin: the return strategies are ranked on.</summary>
    public decimal RiskAdjustedReturn => ExpectedAnnualReturn - RiskProfile.MarginInPoints();
}
