using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.SavedCalculations;

/// <summary>
/// A calculation the user saved under a name. The inputs are kept in their API contract shape, so a
/// saved calculation can always be sent back to the calculate endpoint unchanged.
/// </summary>
public sealed class SavedCalculation
{
    /// <summary>The id. Version 7 GUIDs are time-ordered, which keeps database inserts sequential.</summary>
    public required Guid Id { get; init; }

    /// <summary>The name to find it by.</summary>
    public required string Name { get; set; }

    /// <summary>The calculator inputs.</summary>
    public required AmortizationRequest Inputs { get; set; }

    /// <summary>When it was first saved.</summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>When it was last renamed or replaced.</summary>
    public required DateTimeOffset UpdatedAt { get; set; }
}
