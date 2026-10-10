using Microsoft.EntityFrameworkCore;
using MortgageAnalytics.Application.SavedCalculations;

namespace MortgageAnalytics.Infrastructure;

/// <summary>Stores saved calculations with EF Core. One instance per HTTP request, like its context.</summary>
/// <param name="db">The database context.</param>
public sealed class SavedCalculationRepository(CalculationsDbContext db) : ISavedCalculationRepository
{
    private const string LikeEscape = "\\";

    /// <inheritdoc />
    public async Task<IReadOnlyList<SavedCalculation>> ListAsync(string ownerId, string? search, CancellationToken cancellationToken)
    {
        var query = db.SavedCalculations.AsNoTracking().Where(c => c.OwnerId == ownerId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = ContainsPattern(search);
            query = query.Where(c => EF.Functions.Like(c.Name, pattern, LikeEscape));
        }

        return await query.OrderByDescending(c => c.UpdatedAt).ToListAsync(cancellationToken);
    }

    /// <summary>
    /// A LIKE pattern matching names that contain <paramref name="search"/>. SQLite's LIKE ignores case;
    /// escaping its wildcards makes a "%" or "_" in the search match only itself.
    /// </summary>
    private static string ContainsPattern(string search)
    {
        var literal = search.Trim()
            .Replace(LikeEscape, LikeEscape + LikeEscape, StringComparison.Ordinal)
            .Replace("%", LikeEscape + "%", StringComparison.Ordinal)
            .Replace("_", LikeEscape + "_", StringComparison.Ordinal);
        return $"%{literal}%";
    }

    /// <inheritdoc />
    public Task<SavedCalculation?> FindAsync(string ownerId, Guid id, CancellationToken cancellationToken) =>
        db.SavedCalculations.SingleOrDefaultAsync(c => c.Id == id && c.OwnerId == ownerId, cancellationToken);

    /// <inheritdoc />
    public async Task AddAsync(SavedCalculation calculation, CancellationToken cancellationToken)
    {
        db.SavedCalculations.Add(calculation);
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task UpdateAsync(SavedCalculation calculation, CancellationToken cancellationToken)
    {
        // The calculation came from FindAsync on this context, so it is tracked and its changes are known.
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> DeleteAsync(string ownerId, Guid id, CancellationToken cancellationToken) =>
        await db.SavedCalculations.Where(c => c.Id == id && c.OwnerId == ownerId).ExecuteDeleteAsync(cancellationToken) > 0;
}
