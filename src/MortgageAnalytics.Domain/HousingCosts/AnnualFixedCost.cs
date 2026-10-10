namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// A yearly bill paid in twelve monthly installments. It can rise by a set percentage each year,
/// and it can end after a set number of years. Used for homeowners insurance (rises, never ends)
/// and PID assessments (fixed, end once the district's bonds are repaid).
/// </summary>
public sealed class AnnualFixedCost : IHousingCost
{
    private readonly int? _lastPaymentNumber;

    /// <summary>Creates a cost of <paramref name="annualAmount"/> in the first year.</summary>
    /// <param name="category">The category to report the cost under.</param>
    /// <param name="annualAmount">The first year's amount in dollars.</param>
    /// <param name="durationInYears">How many years the cost lasts, counted from the first payment. Null means it never ends.</param>
    /// <param name="annualIncreasePercent">How much the amount rises each year, as a percentage (5 means +5%).</param>
    /// <exception cref="DomainValidationException">The amount is negative, the duration is under one year, or the increase is -100% or less.</exception>
    public AnnualFixedCost(HousingCostCategory category, decimal annualAmount, int? durationInYears = null, decimal annualIncreasePercent = 0m)
    {
        HousingCostGuard.AgainstNegative(annualAmount, nameof(annualAmount));
        HousingCostGuard.AgainstInvalidGrowth(annualIncreasePercent);
        if (durationInYears is < 1)
            throw new DomainValidationException("A cost's duration must be at least one year.");

        Category = category;
        AnnualAmount = annualAmount;
        DurationInYears = durationInYears;
        AnnualIncreasePercent = annualIncreasePercent;
        _lastPaymentNumber = durationInYears * 12;
    }

    /// <inheritdoc />
    public HousingCostCategory Category { get; }

    /// <summary>The first year's amount in dollars.</summary>
    public decimal AnnualAmount { get; }

    /// <summary>How many years the cost lasts, or null if it never ends.</summary>
    public int? DurationInYears { get; }

    /// <summary>How much the amount rises each year, as a percentage.</summary>
    public decimal AnnualIncreasePercent { get; }

    /// <summary>Returns the yearly amount in loan year <paramref name="year"/> (0-based), after increases.</summary>
    public decimal AnnualAmountInYear(int year) => Growth.Compound(AnnualAmount, AnnualIncreasePercent, year);

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) =>
        _lastPaymentNumber is null || period.PaymentNumber <= _lastPaymentNumber
            ? Installments.MonthlyShare(AnnualAmountInYear(LoanCalendar.YearOf(period.PaymentNumber)), period.PaymentNumber)
            : 0m;
}
