using Microsoft.EntityFrameworkCore;
using MortgageAnalytics.Application.Passkeys;

namespace MortgageAnalytics.Infrastructure;

/// <summary>Stores users' passkeys with EF Core. One instance per HTTP request, like its context.</summary>
/// <param name="db">The database context.</param>
public sealed class PasskeyRepository(CalculationsDbContext db) : IPasskeyRepository
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<Passkey>> ListAsync(string ownerId, CancellationToken cancellationToken) =>
        await db.Passkeys.AsNoTracking().Where(p => p.OwnerId == ownerId).OrderBy(p => p.CreatedAt).ToListAsync(cancellationToken);

    /// <inheritdoc />
    public Task<Passkey?> FindAsync(byte[] credentialId, CancellationToken cancellationToken) =>
        db.Passkeys.AsNoTracking().SingleOrDefaultAsync(p => p.CredentialId == credentialId, cancellationToken);

    /// <inheritdoc />
    public async Task AddAsync(Passkey passkey, CancellationToken cancellationToken)
    {
        db.Passkeys.Add(passkey);
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task RecordUseAsync(byte[] credentialId, uint signCount, DateTimeOffset at, CancellationToken cancellationToken)
    {
        var passkey = await db.Passkeys.SingleOrDefaultAsync(p => p.CredentialId == credentialId, cancellationToken);
        if (passkey is null)
            return;

        passkey.SignCount = signCount;
        passkey.LastUsedAt = at;
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> DeleteAsync(string ownerId, byte[] credentialId, CancellationToken cancellationToken) =>
        await db.Passkeys.Where(p => p.OwnerId == ownerId && p.CredentialId == credentialId).ExecuteDeleteAsync(cancellationToken) > 0;
}
