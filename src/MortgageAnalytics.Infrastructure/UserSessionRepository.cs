using Microsoft.EntityFrameworkCore;
using MortgageAnalytics.Application.Sessions;

namespace MortgageAnalytics.Infrastructure;

/// <summary>Stores where each user is signed in. One instance per HTTP request, like its context.</summary>
/// <param name="db">The database context.</param>
public sealed class UserSessionRepository(CalculationsDbContext db) : IUserSessionRepository
{
    /// <inheritdoc />
    public async Task AddAsync(UserSession session, CancellationToken cancellationToken)
    {
        db.UserSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> TouchAsync(Guid id, string ownerId, DateTimeOffset now, TimeSpan refreshAfter, CancellationToken cancellationToken)
    {
        var lastSeen = await db.UserSessions.AsNoTracking()
            .Where(s => s.Id == id && s.OwnerId == ownerId)
            .Select(s => (DateTimeOffset?)s.LastSeenAt)
            .SingleOrDefaultAsync(cancellationToken);
        if (lastSeen is null)
            return false;

        if (now - lastSeen >= refreshAfter)
            await db.UserSessions.Where(s => s.Id == id && s.OwnerId == ownerId).ExecuteUpdateAsync(set => set.SetProperty(s => s.LastSeenAt, now), cancellationToken);
        return true;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<UserSession>> ListAsync(string ownerId, DateTimeOffset activeSince, CancellationToken cancellationToken)
    {
        await db.UserSessions.Where(s => s.OwnerId == ownerId && s.LastSeenAt < activeSince).ExecuteDeleteAsync(cancellationToken);
        return await db.UserSessions.AsNoTracking().Where(s => s.OwnerId == ownerId).OrderByDescending(s => s.LastSeenAt).ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> DeleteAsync(string ownerId, Guid id, CancellationToken cancellationToken) =>
        await db.UserSessions.Where(s => s.Id == id && s.OwnerId == ownerId).ExecuteDeleteAsync(cancellationToken) > 0;

    /// <inheritdoc />
    public Task<int> DeleteOthersAsync(string ownerId, Guid keep, CancellationToken cancellationToken) =>
        db.UserSessions.Where(s => s.OwnerId == ownerId && s.Id != keep).ExecuteDeleteAsync(cancellationToken);
}
