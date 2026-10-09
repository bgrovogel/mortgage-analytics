namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// A fixed yearly bill paid in twelve monthly installments, optionally for a limited number of years.
/// Used for homeowners insurance (no end date) and PID assessments (which end once the district's bonds are repaid).
/// </summary>
public sealed class AnnualFixedCost : IHousingCost
{
    private readonly decimal _monthlyAmount;
    private readonly int? _lastPaymentNumber;

    /// <summary>Creates a cost of <paramref name="annualAmount"/> per year.</summary>
    /// <param name="category">The category to report the cost under.</param>
    /// <param name="annualAmount">The yearly amount in dollars.</param>
    /// <param name="durationInYears">How many years the cost lasts, counted from the first payment. Null means it never ends.</param>
    /// <exception cref="DomainValidationException">The amount is negative or the duration is under one year.</exception>
    public AnnualFixedCost(HousingCostCategory category, decimal annualAmount, int? durationInYears = null)
    {
        HousingCostGuard.AgainstNegative(annualAmount, nameof(annualAmount));
        if (durationInYears is < 1)
            throw new DomainValidationException("A cost's duration must be at least one year.");

        Category = category;
        AnnualAmount = annualAmount;
        DurationInYears = durationInYears;
        _monthlyAmount = Money.Round(annualAmount / 12m);
        _lastPaymentNumber = durationInYears * 12;
    }

    /// <inheritdoc />
    public HousingCostCategory Category { get; }

    /// <summary>The yearly amount in dollars.</summary>
    public decimal AnnualAmount { get; }

    /// <summary>How many years the cost lasts, or null if it never ends.</summary>
    public int? DurationInYears { get; }

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) =>
        _lastPaymentNumber is null || period.PaymentNumber <= _lastPaymentNumber ? _monthlyAmount : 0m;
}
