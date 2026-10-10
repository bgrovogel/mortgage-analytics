using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// The home's market value and its taxable (assessed) value, year by year.
/// </summary>
/// <remarks>
/// Market value grows at a steady annual rate. Assessed value follows it, except that an
/// assessment cap limits how much the <i>taxable</i> value may rise in one year. Texas caps a
/// homestead at +10% a year, so in a fast-rising market the taxable value lags behind the market
/// value, and the owner pays tax on the lower figure.
/// <para>Years are loan years (see <see cref="LoanCalendar"/>), not county appraisal years.</para>
/// </remarks>
public sealed class PropertyValuation
{
    /// <summary>How many years are projected: enough for the longest supported loan.</summary>
    public const int ProjectedYears = LoanTerms.MaxTermInMonths / 12;

    private readonly decimal[] _marketValues = new decimal[ProjectedYears];
    private readonly decimal[] _assessedValues = new decimal[ProjectedYears];

    /// <summary>Projects market and assessed values from <paramref name="initialValue"/>.</summary>
    /// <param name="initialValue">The value in the first year, normally the purchase price.</param>
    /// <param name="annualGrowthPercent">Expected market appreciation per year (3 means +3%). May be negative.</param>
    /// <param name="assessmentCapPercent">The most the taxable value may rise in a year (10 for a Texas homestead), or null for no cap.</param>
    /// <exception cref="DomainValidationException">The value is not positive, growth is -100% or less, or the cap is negative.</exception>
    public PropertyValuation(decimal initialValue, decimal annualGrowthPercent = 0m, decimal? assessmentCapPercent = null)
    {
        if (initialValue <= 0)
            throw new DomainValidationException("Property value must be greater than zero.");
        if (annualGrowthPercent <= -100)
            throw new DomainValidationException("Annual growth must be greater than -100%.");
        if (assessmentCapPercent < 0)
            throw new DomainValidationException("An assessment cap cannot be negative.");

        AnnualGrowthPercent = annualGrowthPercent;
        AssessmentCapPercent = assessmentCapPercent;

        for (var year = 0; year < ProjectedYears; year++)
        {
            _marketValues[year] = Growth.Compound(initialValue, annualGrowthPercent, year);
            _assessedValues[year] = year == 0 || assessmentCapPercent is null
                ? _marketValues[year]
                : Math.Min(_marketValues[year], Money.Round(_assessedValues[year - 1] * (1 + assessmentCapPercent.Value / 100m)));
        }
    }

    /// <summary>Expected market appreciation per year, as a percentage.</summary>
    public decimal AnnualGrowthPercent { get; }

    /// <summary>The most the taxable value may rise in a year, as a percentage, or null when uncapped.</summary>
    public decimal? AssessmentCapPercent { get; }

    /// <summary>Returns the projected market value in loan year <paramref name="year"/> (0-based).</summary>
    /// <exception cref="ArgumentOutOfRangeException">The year is outside the projection; that is a bug, not something to clamp.</exception>
    public decimal MarketValueInYear(int year) => _marketValues[Checked(year)];

    /// <summary>Returns the taxable (assessed) value in loan year <paramref name="year"/> (0-based), after any cap.</summary>
    /// <exception cref="ArgumentOutOfRangeException">The year is outside the projection.</exception>
    public decimal AssessedValueInYear(int year) => _assessedValues[Checked(year)];

    private static int Checked(int year)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(year);
        ArgumentOutOfRangeException.ThrowIfGreaterThanOrEqual(year, ProjectedYears);
        return year;
    }
}
