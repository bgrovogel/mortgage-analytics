using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.SavedCalculations;

/// <summary>
/// A calculation the user saved under a name: calculator inputs (with up to three other homes, when they are compared), a
/// refinance comparison, or a pay-off-or-invest comparison. Exactly one of the three is set. The
/// inputs are kept in their API contract shape, so they can always be sent back to their endpoint unchanged.
/// </summary>
public sealed class SavedCalculation
{
    /// <summary>The id. Version 7 GUIDs are time-ordered, which keeps database inserts sequential.</summary>
    public required Guid Id { get; init; }

    /// <summary>The id of the user it belongs to. Only that user can list, read, change or delete it.</summary>
    public required string OwnerId { get; init; }

    /// <summary>The name to find it by.</summary>
    public required string Name { get; set; }

    /// <summary>A few words to remind its owner what it was for; null for none.</summary>
    public string? Note { get; set; }

    /// <summary>The calculator inputs, for a purchase calculation or the first of the homes compared; otherwise null.</summary>
    public AmortizationRequest? Inputs { get; set; }

    /// <summary>The other homes, one to three, when homes are compared; otherwise null.</summary>
    public IReadOnlyList<AmortizationRequest>? OtherHomes { get; set; }

    /// <summary>The comparison inputs, for a refinance comparison; otherwise null.</summary>
    public RefinanceRequest? Refinance { get; set; }

    /// <summary>The comparison inputs, for a pay-off-or-invest comparison; otherwise null.</summary>
    public StrategyRequest? Strategy { get; set; }

    /// <summary>What this is, read from which inputs it holds.</summary>
    public SavedCalculationKind Kind =>
        Inputs is not null ? (OtherHomes is null ? SavedCalculationKind.Purchase : SavedCalculationKind.HomeComparison)
        : Refinance is not null ? SavedCalculationKind.Refinance
        : SavedCalculationKind.Strategy;

    /// <summary>When it was first saved.</summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>When it was last renamed or replaced.</summary>
    public required DateTimeOffset UpdatedAt { get; set; }
}
