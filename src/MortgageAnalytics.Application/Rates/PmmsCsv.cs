using System.Globalization;

namespace MortgageAnalytics.Application.Rates;

/// <summary>
/// Reads Freddie Mac's Primary Mortgage Market Survey history: a CSV with a header row, then a row for each week, the
/// newest last. Columns are found by name (<c>date</c>, <c>pmms30</c>, <c>pmms15</c>), so a column added or moved does not
/// matter. Anything that is not the survey (an error page, an empty file, a rate no loan could have) gives nothing, never
/// a wrong rate.
/// </summary>
public static class PmmsCsv
{
    /// <summary>The latest week that has both rates.</summary>
    /// <param name="csv">The file's text.</param>
    /// <returns>The rates, or null when the text holds none.</returns>
    public static AverageRates? Parse(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv))
            return null;

        var lines = csv.TrimStart('\uFEFF').Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2)
            return null;

        var header = lines[0].Split(',').Select(h => h.Trim().ToLowerInvariant()).ToList();
        var (date, thirty, fifteen) = (header.IndexOf("date"), header.IndexOf("pmms30"), header.IndexOf("pmms15"));
        if (date < 0 || thirty < 0 || fifteen < 0)
            return null;

        for (var i = lines.Length - 1; i >= 1; i--)
        {
            var cells = lines[i].Split(',');
            if (cells.Length <= Math.Max(date, Math.Max(thirty, fifteen)))
                continue;

            if (DateOnly.TryParseExact(cells[date].Trim(), "M/d/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var week)
                && Rate(cells[thirty]) is { } thirtyYear
                && Rate(cells[fifteen]) is { } fifteenYear)
                return new AverageRates(week, thirtyYear, fifteenYear);

            // A row that is blank in one rate is a week not fully published: the one before is the latest. A row that is
            // broken in any other way is not the survey, and nothing after it can be trusted.
            if (string.IsNullOrWhiteSpace(cells[thirty]) || string.IsNullOrWhiteSpace(cells[fifteen]))
                continue;
            return null;
        }
        return null;
    }

    /// <summary>A rate a loan could have: more than 0% and at most 30%.</summary>
    private static decimal? Rate(string cell) =>
        decimal.TryParse(cell.Trim(), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var rate) && rate is > 0 and <= 30 ? rate : null;
}
