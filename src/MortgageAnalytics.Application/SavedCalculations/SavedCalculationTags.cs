namespace MortgageAnalytics.Application.SavedCalculations;

/// <summary>The tags of a saved calculation: short handles to find it by.</summary>
public static class SavedCalculationTags
{
    /// <summary>The tags as they are kept: trimmed, without blanks, and without repeats (in any case), in the order given.</summary>
    public static List<string> Normalize(IEnumerable<string>? tags) =>
        tags is null
            ? []
            : [.. tags.Select(tag => tag.Trim()).Where(tag => tag.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase)];
}
