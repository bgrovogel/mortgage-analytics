namespace MortgageAnalytics.Application.Contracts;

/// <summary>One place the account is signed in.</summary>
/// <param name="Id">The session's id: what ending it is addressed by.</param>
/// <param name="Device">The browser and system, e.g. "Chrome on Windows".</param>
/// <param name="CreatedAt">When this sign-in began.</param>
/// <param name="LastSeenAt">When it was last used, to within a few minutes.</param>
/// <param name="Current">True for the session making this request.</param>
public sealed record UserSessionResponse(Guid Id, string Device, DateTimeOffset CreatedAt, DateTimeOffset LastSeenAt, bool Current);

/// <summary>How many sessions were ended.</summary>
/// <param name="Ended">The number ended.</param>
public sealed record EndedSessionsResponse(int Ended);
