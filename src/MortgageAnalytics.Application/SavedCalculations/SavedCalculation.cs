using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.SavedCalculations;

/// <summary>
/// A calculation the user saved under a name: either calculator inputs or a refinance comparison. The
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

    /// <summary>The calculator inputs, for a purchase calculation; otherwise null.</summary>
    public AmortizationRequest? Inputs { get; set; }

    /// <summary>The comparison inputs, for a refinance comparison; otherwise null.</summary>
    public RefinanceRequest? Refinance { get; set; }

    /// <summary>What this is, read from which inputs it holds.</summary>
    public SavedCalculationKind Kind => Inputs is null ? SavedCalculationKind.Refinance : SavedCalculationKind.Purchase;

    /// <summary>When it was first saved.</summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>When it was last renamed or replaced.</summary>
    public required DateTimeOffset UpdatedAt { get; set; }
}
