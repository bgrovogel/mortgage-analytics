namespace MortgageAnalytics.Domain.Strategies;

/// <summary>Which market path a projection assumes.</summary>
public enum MarketScenarioKind
{
    /// <summary>The user's expected return, every year.</summary>
    Expected = 0,

    /// <summary>The expected return minus the risk profile's margin, every year. Strategies are ranked on this.</summary>
    RiskAdjusted = 1,

    /// <summary>A lost decade first (like 2000–2009), then the risk-adjusted return.</summary>
    BadDecade = 2,
}

/// <summary>A path of yearly market returns.</summary>
public sealed record MarketScenario
{
    /// <summary>
    /// The yearly return during a bad decade, as a percentage: about what the S&amp;P 500 returned a year,
    /// dividends included, from 2000 through 2009.
    /// </summary>
    public const decimal BadDecadeAnnualReturn = -1m;

    /// <summary>How many years the bad stretch lasts.</summary>
    public const int BadDecadeYears = 10;

    private MarketScenario(MarketScenarioKind kind, decimal annualReturn, int badYears)
    {
        if (annualReturn is < -50 or > 50)
            throw new DomainValidationException("An annual market return must be between -50% and 50%.");

        Kind = kind;
        AnnualReturn = annualReturn;
        BadYears = badYears;
    }

    /// <summary>Which scenario this is.</summary>
    public MarketScenarioKind Kind { get; }

    /// <summary>The yearly return, as a percentage, outside the bad years.</summary>
    public decimal AnnualReturn { get; }

    /// <summary>How many years at the start return <see cref="BadDecadeAnnualReturn"/> instead.</summary>
    public int BadYears { get; }

    /// <summary>The same return every year.</summary>
    /// <param name="kind"><see cref="MarketScenarioKind.Expected"/> or <see cref="MarketScenarioKind.RiskAdjusted"/>.</param>
    /// <param name="annualReturn">The yearly return, as a percentage.</param>
    public static MarketScenario Steady(MarketScenarioKind kind, decimal annualReturn) => new(kind, annualReturn, 0);

    /// <summary>A bad decade first, then <paramref name="annualReturn"/>.</summary>
    /// <param name="annualReturn">The yearly return once the bad decade is over, as a percentage.</param>
    public static MarketScenario BadDecadeThen(decimal annualReturn) => new(MarketScenarioKind.BadDecade, annualReturn, BadDecadeYears);

    /// <summary>The return in year <paramref name="year"/> (1-based), as a percentage.</summary>
    /// <param name="year">The year of the projection, starting at 1.</param>
    public decimal AnnualReturnInYear(int year) => year <= BadYears ? BadDecadeAnnualReturn : AnnualReturn;

    /// <summary>
    /// What a dollar grows to in one month of year <paramref name="year"/>: the twelfth root of the yearly
    /// growth, so twelve months compound to exactly the yearly return (10% a year is about 0.797% a month, not 10 ÷ 12).
    /// </summary>
    /// <param name="year">The year of the projection, starting at 1.</param>
    public decimal MonthlyGrowthFactorInYear(int year) => MonthlyGrowthFactor(AnnualReturnInYear(year));

    /// <summary>The monthly growth factor for a yearly return of <paramref name="annualPercent"/>.</summary>
    /// <remarks>
    /// A twelfth root has no exact decimal form, so it is taken in double precision and rounded to ten
    /// decimal places: far below a cent on any balance the app accepts, and the same on every machine.
    /// </remarks>
    /// <param name="annualPercent">The yearly return, as a percentage.</param>
    public static decimal MonthlyGrowthFactor(decimal annualPercent) =>
        Math.Round((decimal)Math.Pow(1 + (double)(annualPercent / 100m), 1.0 / 12), 10, MidpointRounding.AwayFromZero);
}
