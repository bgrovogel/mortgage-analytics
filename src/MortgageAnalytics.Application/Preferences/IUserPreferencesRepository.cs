using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Preferences;

/// <summary>Storage for what a signed-in user has chosen about how the app looks to them, one set per user.</summary>
public interface IUserPreferencesRepository
{
    /// <summary>The user's key-figure arrangement.</summary>
    /// <param name="ownerId">Whose arrangement.</param>
    /// <param name="cancellationToken">Cancels the query.</param>
    /// <returns>The arrangement; an empty one when the user has not made any.</returns>
    Task<KeyFigurePreferences> GetKeyFiguresAsync(string ownerId, CancellationToken cancellationToken);

    /// <summary>Replaces the user's key-figure arrangement.</summary>
    /// <param name="ownerId">Whose arrangement.</param>
    /// <param name="preferences">The new arrangement.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once it is stored.</returns>
    Task SaveKeyFiguresAsync(string ownerId, KeyFigurePreferences preferences, CancellationToken cancellationToken);
}
