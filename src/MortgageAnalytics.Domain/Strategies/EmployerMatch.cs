namespace MortgageAnalytics.Domain.Strategies;

/// <summary>An employer's 401(k) match: <see cref="MatchPercent"/> of what the employee puts in, on up to <see cref="UpToPercentOfPay"/> of pay.</summary>
public sealed record EmployerMatch
{
    /// <summary>Creates a match formula, rejecting any value outside the supported range.</summary>
    /// <param name="matchPercent">How much the employer adds per dollar contributed, as a percentage (50 means 50 cents).</param>
    /// <param name="upToPercentOfPay">The share of pay the match applies to, as a percentage.</param>
    /// <exception cref="DomainValidationException">A value is out of range.</exception>
    public EmployerMatch(decimal matchPercent, decimal upToPercentOfPay)
    {
        if (matchPercent is < 0 or > 200)
            throw new DomainValidationException("The employer match must be between 0% and 200% of contributions.");
        if (upToPercentOfPay is < 0 or > 100)
            throw new DomainValidationException("The matched share of pay must be between 0% and 100%.");

        MatchPercent = matchPercent;
        UpToPercentOfPay = upToPercentOfPay;
    }

    /// <summary>No employer match.</summary>
    public static EmployerMatch None { get; } = new(0m, 0m);

    /// <summary>How much the employer adds per dollar contributed, as a percentage.</summary>
    public decimal MatchPercent { get; }

    /// <summary>The share of pay the match applies to, as a percentage.</summary>
    public decimal UpToPercentOfPay { get; }

    /// <summary>True when there is a match to capture.</summary>
    public bool Exists => MatchPercent > 0 && UpToPercentOfPay > 0;
}
