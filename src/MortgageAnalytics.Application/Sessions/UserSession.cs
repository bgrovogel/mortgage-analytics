namespace MortgageAnalytics.Application.Sessions;

/// <summary>
/// One place a user is signed in: a sign-in with a session cookie, from a browser. Its id is in the cookie, so a request
/// can be told apart from the same account's others, and ending the row ends that cookie's sign-in at its next request.
/// Nothing secret is kept: the cookie itself is the user's, and this only says it is still wanted.
/// </summary>
public sealed class UserSession
{
    /// <summary>The id, which the session's cookie carries.</summary>
    public required Guid Id { get; init; }

    /// <summary>The id of the user it belongs to. Only that user can list or end it.</summary>
    public required string OwnerId { get; init; }

    /// <summary>What the person would call the device: the browser and the system, e.g. "Chrome on Windows".</summary>
    public required string Device { get; init; }

    /// <summary>When this sign-in began.</summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>When it was last used, to within a few minutes.</summary>
    public required DateTimeOffset LastSeenAt { get; set; }
}
