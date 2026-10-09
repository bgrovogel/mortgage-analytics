namespace MortgageAnalytics.Domain.Amortization;

/// <summary>
/// Decides when the loan is recast (re-amortized). A recast keeps the payoff date and lowers the
/// monthly payment so the reduced balance is still repaid over the remaining term.
/// </summary>
/// <remarks>
/// A lower payment with the same payoff date is only possible through a recast, and lenders
/// recast only on request, after a single lump sum of at least their minimum (commonly $10,000),
/// for a flat fee. Smaller extra payments shorten the loan instead.
/// <see cref="Never"/> is the default: every extra payment shortens the term.
/// </remarks>
public sealed record RecastPolicy
{
    /// <summary>The lump sum most lenders require before they will recast.</summary>
    public const decimal TypicalMinimumLumpSum = 10_000m;

    private RecastPolicy(bool isEnabled, decimal minimumExtraPrincipal, decimal fee)
    {
        if (minimumExtraPrincipal < 0)
            throw new DomainValidationException("The minimum extra principal for a recast cannot be negative.");
        if (fee < 0)
            throw new DomainValidationException("A recast fee cannot be negative.");

        IsEnabled = isEnabled;
        MinimumExtraPrincipal = minimumExtraPrincipal;
        Fee = fee;
    }

    /// <summary>Never recast: extra principal shortens the term and the payment stays the same.</summary>
    public static RecastPolicy Never { get; } = new(false, 0m, 0m);

    /// <summary>Recast whenever a single period's extra principal is at least <paramref name="minimumExtraPrincipal"/>.</summary>
    /// <param name="minimumExtraPrincipal">The smallest single prepayment the lender will recast for (commonly <see cref="TypicalMinimumLumpSum"/>).</param>
    /// <param name="fee">The lender's charge for each recast (often $150 to $500).</param>
    /// <exception cref="DomainValidationException">Either value is negative.</exception>
    public static RecastPolicy OnLumpSum(decimal minimumExtraPrincipal, decimal fee) => new(true, minimumExtraPrincipal, fee);

    /// <summary>True when this policy recasts at all.</summary>
    public bool IsEnabled { get; }

    /// <summary>The smallest single-period prepayment that triggers a recast.</summary>
    public decimal MinimumExtraPrincipal { get; }

    /// <summary>The fee charged for each recast.</summary>
    public decimal Fee { get; }

    /// <summary>Returns true when a period with <paramref name="extraPrincipal"/> prepaid should be followed by a recast.</summary>
    public bool ShouldRecastAfter(decimal extraPrincipal) =>
        IsEnabled && extraPrincipal > 0 && extraPrincipal >= MinimumExtraPrincipal;
}
