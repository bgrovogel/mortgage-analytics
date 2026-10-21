namespace MortgageAnalytics.Application.Sessions;

/// <summary>Storage for where each user is signed in. Every operation works only on the owner's own sessions.</summary>
public interface IUserSessionRepository
{
    /// <summary>Records a new sign-in.</summary>
    /// <param name="session">The session.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once it is stored.</returns>
    Task AddAsync(UserSession session, CancellationToken cancellationToken);

    /// <summary>
    /// Says whether a session is still wanted, and notes that it is being used, but only when its last use was
    /// <paramref name="refreshAfter"/> or more ago, so a busy page is not a write on every request.
    /// </summary>
    /// <param name="id">The session.</param>
    /// <param name="ownerId">Whose it must be.</param>
    /// <param name="now">The time of this use.</param>
    /// <param name="refreshAfter">How long since the last use before it is recorded again.</param>
    /// <param name="cancellationToken">Cancels the query.</param>
    /// <returns>True while the session exists for that owner; false once it was ended, or never was.</returns>
    Task<bool> TouchAsync(Guid id, string ownerId, DateTimeOffset now, TimeSpan refreshAfter, CancellationToken cancellationToken);

    /// <summary>The owner's sessions used since <paramref name="activeSince"/>, most recently used first; older ones are removed.</summary>
    /// <param name="ownerId">Whose sessions.</param>
    /// <param name="activeSince">The earliest use that is still a session: when its cookie would have expired.</param>
    /// <param name="cancellationToken">Cancels the query.</param>
    /// <returns>The sessions.</returns>
    Task<IReadOnlyList<UserSession>> ListAsync(string ownerId, DateTimeOffset activeSince, CancellationToken cancellationToken);

    /// <summary>Ends one session.</summary>
    /// <param name="ownerId">Whose it must be.</param>
    /// <param name="id">The session.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>True when it was ended; false when the owner has no such session.</returns>
    Task<bool> DeleteAsync(string ownerId, Guid id, CancellationToken cancellationToken);

    /// <summary>Ends every session of the owner except one.</summary>
    /// <param name="ownerId">Whose sessions.</param>
    /// <param name="keep">The session to leave.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>How many were ended.</returns>
    Task<int> DeleteOthersAsync(string ownerId, Guid keep, CancellationToken cancellationToken);
}
