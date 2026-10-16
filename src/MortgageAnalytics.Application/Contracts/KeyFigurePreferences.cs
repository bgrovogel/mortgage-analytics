namespace MortgageAnalytics.Application.Contracts;

/// <summary>
/// Which key figures a signed-in user wants under the Cost headline, and in what order, so their arrangement follows
/// them to every device. The names are the page's own; the API only keeps them, and a name it does not know is
/// ignored by the page that reads it.
/// </summary>
public sealed record KeyFigurePreferences
{
    /// <summary>Every figure in the user's order, shown or not. Empty when the user has not arranged them.</summary>
    /// <example>["payoff", "cash", "afford", "savings", "pmi"]</example>
    public IReadOnlyList<string> Order { get; init; } = [];

    /// <summary>The figures the user has put away.</summary>
    /// <example>["pmi"]</example>
    public IReadOnlyList<string> Hidden { get; init; } = [];
}
