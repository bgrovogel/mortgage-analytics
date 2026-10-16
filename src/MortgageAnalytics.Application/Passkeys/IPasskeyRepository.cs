namespace MortgageAnalytics.Application.Passkeys;

/// <summary>Storage for users' passkeys. Reads and deletes by owner never reveal another user's passkey.</summary>
public interface IPasskeyRepository
{
    /// <summary>The owner's passkeys, the one registered first at the top.</summary>
    /// <param name="ownerId">Whose passkeys.</param>
    /// <param name="cancellationToken">Cancels the query.</param>
    /// <returns>The owner's passkeys.</returns>
    Task<IReadOnlyList<Passkey>> ListAsync(string ownerId, CancellationToken cancellationToken);

    /// <summary>Finds a passkey by the credential id a device sent, whoever owns it.</summary>
    /// <param name="credentialId">The credential id.</param>
    /// <param name="cancellationToken">Cancels the query.</param>
    /// <returns>The passkey, or null when none has that id.</returns>
    Task<Passkey?> FindAsync(byte[] credentialId, CancellationToken cancellationToken);

    /// <summary>Stores a new passkey.</summary>
    /// <param name="passkey">The passkey to add.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once it is stored.</returns>
    Task AddAsync(Passkey passkey, CancellationToken cancellationToken);

    /// <summary>Records a sign-in: the device's new counter, and when.</summary>
    /// <param name="credentialId">The passkey that signed in.</param>
    /// <param name="signCount">The counter the device reported.</param>
    /// <param name="at">When it signed in.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once it is stored.</returns>
    Task RecordUseAsync(byte[] credentialId, uint signCount, DateTimeOffset at, CancellationToken cancellationToken);

    /// <summary>Deletes one of the owner's passkeys.</summary>
    /// <param name="ownerId">Whose passkey it must be.</param>
    /// <param name="credentialId">The credential id.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>False when the owner has no such passkey.</returns>
    Task<bool> DeleteAsync(string ownerId, byte[] credentialId, CancellationToken cancellationToken);
}
