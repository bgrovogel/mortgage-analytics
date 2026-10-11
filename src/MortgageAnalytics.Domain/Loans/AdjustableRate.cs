namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// An adjustable-rate mortgage (ARM): a starting rate fixed for a while, then a rate that resets at a regular
/// interval to wherever its index (plus margin) stands, within caps. Nobody knows where the index will be, so the
/// path is an assumption: each reset moves toward <see cref="ExpectedRate"/> as far as the caps allow.
/// </summary>
/// <remarks>
/// The caps, as lenders quote them ("2/1/5"): the most the first reset can move the rate, the most each later
/// reset can, and the most the rate can ever be above (or below) the starting rate. A 7/1 ARM is
/// <c>new AdjustableRate(84, 12, …)</c>; a 7/6 ARM resets every 6 months.
/// </remarks>
public sealed record AdjustableRate
{
    /// <summary>The largest cap accepted, in percentage points.</summary>
    public const decimal MaxCap = 10m;

    /// <summary>Creates an ARM's terms, rejecting any value outside the supported range.</summary>
    /// <param name="initialFixedMonths">How many payments the starting rate lasts, e.g. 84 for a 7/1 ARM.</param>
    /// <param name="adjustmentIntervalMonths">How often the rate resets after that, e.g. 12, or 6.</param>
    /// <param name="expectedRate">The rate the index (plus margin) is assumed to settle at, as a percentage.</param>
    /// <param name="initialCap">The most the first reset can move the rate, in points.</param>
    /// <param name="periodicCap">The most each later reset can move the rate, in points.</param>
    /// <param name="lifetimeCap">The most the rate can ever differ from the starting rate, in points.</param>
    /// <exception cref="DomainValidationException">A value is out of range.</exception>
    public AdjustableRate(int initialFixedMonths, int adjustmentIntervalMonths, decimal expectedRate, decimal initialCap, decimal periodicCap, decimal lifetimeCap)
    {
        if (initialFixedMonths is < 1 or >= LoanTerms.MaxTermInMonths)
            throw new DomainValidationException("The fixed period must be at least one payment and shorter than the longest term.");
        if (adjustmentIntervalMonths is < 1 or > 120)
            throw new DomainValidationException("The rate must reset every 1 to 120 months.");
        if (expectedRate is < 0 or > LoanTerms.MaxAnnualInterestRate)
            throw new DomainValidationException($"The expected rate must be between 0 and {LoanTerms.MaxAnnualInterestRate}%.");
        if (initialCap is < 0 or > MaxCap || periodicCap is < 0 or > MaxCap || lifetimeCap is < 0 or > MaxCap)
            throw new DomainValidationException($"Caps must be between 0 and {MaxCap} points.");

        InitialFixedMonths = initialFixedMonths;
        AdjustmentIntervalMonths = adjustmentIntervalMonths;
        ExpectedRate = expectedRate;
        InitialCap = initialCap;
        PeriodicCap = periodicCap;
        LifetimeCap = lifetimeCap;
    }

    /// <summary>How many payments the starting rate lasts.</summary>
    public int InitialFixedMonths { get; }

    /// <summary>How often the rate resets after the fixed period, in months.</summary>
    public int AdjustmentIntervalMonths { get; }

    /// <summary>The rate each reset moves toward, as a percentage.</summary>
    public decimal ExpectedRate { get; }

    /// <summary>The most the first reset can move the rate, in points.</summary>
    public decimal InitialCap { get; }

    /// <summary>The most each later reset can move the rate, in points.</summary>
    public decimal PeriodicCap { get; }

    /// <summary>The most the rate can ever differ from the starting rate, in points.</summary>
    public decimal LifetimeCap { get; }

    private readonly decimal? _margin;

    /// <summary>
    /// The margin over the index, which ARM notes make the rate's floor: resets never take the rate below it, and the
    /// lifetime cap then only limits the rise. Null when not given: the lifetime cap then limits the fall as well.
    /// </summary>
    /// <exception cref="DomainValidationException">The margin is outside 0 to the highest rate accepted.</exception>
    public decimal? Margin
    {
        get => _margin;
        init
        {
            if (value is < 0 or > LoanTerms.MaxAnnualInterestRate)
                throw new DomainValidationException($"The margin must be between 0 and {LoanTerms.MaxAnnualInterestRate}%.");
            _margin = value;
        }
    }

    /// <summary>
    /// The resets of a loan starting at <paramref name="initialRate"/> over <paramref name="termInMonths"/> payments:
    /// at each, the rate moves toward the expected rate by at most the cap for that reset, and stays within the
    /// lifetime cap of the starting rate, and never below the margin when one is given (never above the starting rate,
    /// as a floor). Resets that leave the rate where it is are left out.
    /// </summary>
    /// <param name="initialRate">The starting rate, as a percentage.</param>
    /// <param name="termInMonths">The loan's term.</param>
    /// <returns>The rate changes, in order.</returns>
    public IReadOnlyList<RateChange> RatePath(decimal initialRate, int termInMonths)
    {
        var changes = new List<RateChange>();
        var floor = Margin is { } margin ? Math.Min(margin, initialRate) : Math.Max(0m, initialRate - LifetimeCap);
        var ceiling = Math.Min(LoanTerms.MaxAnnualInterestRate, initialRate + LifetimeCap);
        var rate = initialRate;

        for (var payment = InitialFixedMonths + 1; payment <= termInMonths; payment += AdjustmentIntervalMonths)
        {
            var cap = payment == InitialFixedMonths + 1 ? InitialCap : PeriodicCap;
            var next = Math.Clamp(Math.Clamp(ExpectedRate, rate - cap, rate + cap), floor, ceiling);
            if (next != rate) changes.Add(new RateChange(payment, next));
            rate = next;
        }

        return changes;
    }

    /// <summary>The same ARM if rates rise as far as the caps allow: the rate the lifetime cap ends at, reached as fast as the caps let it.</summary>
    /// <param name="initialRate">The starting rate, as a percentage.</param>
    public AdjustableRate WorstCase(decimal initialRate) =>
        new(InitialFixedMonths, AdjustmentIntervalMonths, Math.Min(LoanTerms.MaxAnnualInterestRate, initialRate + LifetimeCap),
            InitialCap, PeriodicCap, LifetimeCap) { Margin = Margin };
}
