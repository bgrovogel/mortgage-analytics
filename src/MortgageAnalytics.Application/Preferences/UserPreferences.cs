namespace MortgageAnalytics.Application.Preferences;

/// <summary>
/// What one signed-in user has chosen about how the app looks to them. The figure lists are stored as comma-separated
/// names (a name is a short lowercase word, so a comma is never inside one).
/// </summary>
public sealed class UserPreferences
{
    /// <summary>The id of the user these belong to.</summary>
    public required string OwnerId { get; init; }

    /// <summary>The key figures in the user's order, comma-separated; empty when they have not arranged them.</summary>
    public string KeyFigureOrder { get; set; } = "";

    /// <summary>The key figures the user has put away, comma-separated.</summary>
    public string KeyFiguresHidden { get; set; } = "";
}
