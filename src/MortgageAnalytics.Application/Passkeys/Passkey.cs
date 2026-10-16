namespace MortgageAnalytics.Application.Passkeys;

/// <summary>
/// A passkey a user registered: the public half of a key pair whose private half never leaves their device. Signing in
/// proves possession of the private key, so there is no secret here to steal.
/// </summary>
public sealed class Passkey
{
    /// <summary>The credential id the device chose; unique across all users.</summary>
    public required byte[] CredentialId { get; init; }

    /// <summary>The id of the user it belongs to.</summary>
    public required string OwnerId { get; init; }

    /// <summary>The public key, as the authenticator sent it (a COSE key), for checking each sign-in's signature.</summary>
    public required byte[] PublicKey { get; init; }

    /// <summary>The opaque handle the device keeps for the user, sent back at sign-in so the account can be found.</summary>
    public required byte[] UserHandle { get; init; }

    /// <summary>How many times the device says it has signed: it only goes up, so a copied key shows as a repeat.</summary>
    public required uint SignCount { get; set; }

    /// <summary>What the user calls it, to tell their passkeys apart.</summary>
    public required string Name { get; set; }

    /// <summary>When it was registered.</summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>When it last signed in; null until it has.</summary>
    public DateTimeOffset? LastUsedAt { get; set; }
}
