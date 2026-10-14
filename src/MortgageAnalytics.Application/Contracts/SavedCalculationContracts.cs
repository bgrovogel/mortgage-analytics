namespace MortgageAnalytics.Application.Contracts;

/// <summary>A calculation to save, or to replace a saved one with: a name to find it by, and its inputs.</summary>
public sealed record SaveCalculationRequest
{
    /// <summary>A name to find it by later. 1 to 100 characters; surrounding spaces are trimmed.</summary>
    /// <example>Oak St, 20% down</example>
    public string Name { get; init; } = "";

    /// <summary>The calculator inputs, exactly as sent to the calculate endpoint. Give exactly one of the three kinds.</summary>
    public AmortizationRequest? Inputs { get; init; }

    /// <summary>
    /// One to three more homes to compare with the one in <see cref="Inputs"/>, in the same shape. Only with calculator
    /// inputs: together they are a home comparison of up to four homes.
    /// </summary>
    public IReadOnlyList<AmortizationRequest>? OtherHomes { get; init; }

    /// <summary>A refinance comparison, exactly as sent to the refinance endpoint.</summary>
    public RefinanceRequest? Refinance { get; init; }

    /// <summary>A pay-off-or-invest comparison, exactly as sent to the strategies endpoint.</summary>
    public StrategyRequest? Strategy { get; init; }
}

/// <summary>What a saved calculation is.</summary>
public enum SavedCalculationKind
{
    /// <summary>A home purchase from the calculator; its <c>inputs</c> go to the calculate endpoint.</summary>
    Purchase = 0,

    /// <summary>A refinance comparison; its <c>refinance</c> inputs go to the refinance endpoint.</summary>
    Refinance = 1,

    /// <summary>A pay-off-or-invest comparison; its <c>strategy</c> inputs go to the strategies endpoint.</summary>
    Strategy = 2,

    /// <summary>Two to four homes side by side: <c>inputs</c> and each of <c>otherHomes</c> go to the calculate endpoint.</summary>
    HomeComparison = 3,
}

/// <summary>A saved calculation: its name, its inputs, and when it was saved and last changed.</summary>
public sealed record SavedCalculationResponse
{
    /// <summary>The calculation's id, used in its URL.</summary>
    public required Guid Id { get; init; }

    /// <summary>The name it was saved under.</summary>
    /// <example>Oak St, 20% down</example>
    public required string Name { get; init; }

    /// <summary>Whether this is a purchase, two homes compared, a refinance comparison or a pay-off-or-invest comparison.</summary>
    public required SavedCalculationKind Kind { get; init; }

    /// <summary>For a purchase: the calculator inputs. Post them to the calculate endpoint to see the results again.</summary>
    public required AmortizationRequest? Inputs { get; init; }

    /// <summary>For a home comparison: the other homes, compared with <see cref="Inputs"/>. Null for anything else.</summary>
    public required IReadOnlyList<AmortizationRequest>? OtherHomes { get; init; }

    /// <summary>For a refinance comparison: its inputs. Post them to the refinance endpoint to see the results again.</summary>
    public required RefinanceRequest? Refinance { get; init; }

    /// <summary>For a pay-off-or-invest comparison: its inputs. Post them to the strategies endpoint to see the results again.</summary>
    public required StrategyRequest? Strategy { get; init; }

    /// <summary>When it was first saved.</summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>When it was last renamed or replaced. Equal to <see cref="CreatedAt"/> until then.</summary>
    public required DateTimeOffset UpdatedAt { get; init; }
}
