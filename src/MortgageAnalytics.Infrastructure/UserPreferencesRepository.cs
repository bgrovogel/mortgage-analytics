using Microsoft.EntityFrameworkCore;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Preferences;

namespace MortgageAnalytics.Infrastructure;

/// <summary>Stores what each user has chosen about how the app looks to them. One instance per HTTP request, like its context.</summary>
/// <param name="db">The database context.</param>
public sealed class UserPreferencesRepository(CalculationsDbContext db) : IUserPreferencesRepository
{
    /// <inheritdoc />
    public async Task<KeyFigurePreferences> GetKeyFiguresAsync(string ownerId, CancellationToken cancellationToken)
    {
        var stored = await db.UserPreferences.AsNoTracking().SingleOrDefaultAsync(p => p.OwnerId == ownerId, cancellationToken);
        return stored is null ? new KeyFigurePreferences() : new KeyFigurePreferences { Order = Split(stored.KeyFigureOrder), Hidden = Split(stored.KeyFiguresHidden) };
    }

    /// <inheritdoc />
    public async Task SaveKeyFiguresAsync(string ownerId, KeyFigurePreferences preferences, CancellationToken cancellationToken)
    {
        var stored = await db.UserPreferences.SingleOrDefaultAsync(p => p.OwnerId == ownerId, cancellationToken);
        if (stored is null)
            db.UserPreferences.Add(stored = new UserPreferences { OwnerId = ownerId });

        stored.KeyFigureOrder = string.Join(',', preferences.Order);
        stored.KeyFiguresHidden = string.Join(',', preferences.Hidden);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static string[] Split(string names) => names.Length == 0 ? [] : names.Split(',');
}
