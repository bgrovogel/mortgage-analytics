namespace MortgageAnalytics.Application.Contracts;

/// <summary>A calculation to save, or to replace a saved one with: a name to find it by, and its inputs.</summary>
public sealed record SaveCalculationRequest
{
    /// <summary>A name to find it by later. 1 to 100 characters; surrounding spaces are trimmed.</summary>
    /// <example>Oak St, 20% down</example>
    public string Name { get; init; } = "";

    /// <summary>The calculator inputs, exactly as sent to the calculate endpoint.</summary>
    public AmortizationRequest? Inputs { get; init; }
}

/// <summary>A saved calculation: its name, its inputs, and when it was saved and last changed.</summary>
public sealed record SavedCalculationResponse
{
    /// <summary>The calculation's id, used in its URL.</summary>
    public required Guid Id { get; init; }

    /// <summary>The name it was saved under.</summary>
    /// <example>Oak St, 20% down</example>
    public required string Name { get; init; }

    /// <summary>The calculator inputs. Post them to the calculate endpoint to see the results again.</summary>
    public required AmortizationRequest Inputs { get; init; }

    /// <summary>When it was first saved.</summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>When it was last renamed or replaced. Equal to <see cref="CreatedAt"/> until then.</summary>
    public required DateTimeOffset UpdatedAt { get; init; }
}
