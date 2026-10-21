namespace MortgageAnalytics.Application.Contracts;

/// <summary>
/// Everything the app holds about one account, in one file: so a person can keep a copy, or take it elsewhere. It holds
/// no password hash, no passkey public key and nothing that keeps a session; those are for the server's own use.
/// </summary>
/// <param name="Email">The account's email address.</param>
/// <param name="ExportedAt">When this copy was made.</param>
/// <param name="SavedCalculations">Every saved calculation, with its inputs, so each can be opened again.</param>
/// <param name="Passkeys">Each passkey's name and dates.</param>
/// <param name="KeyFigures">The arrangement of key figures, empty when none was made.</param>
/// <param name="Sessions">Where the account is signed in: each by its device (the browser and system) and when it began and was last used.</param>
public sealed record AccountExport(
    string Email,
    DateTimeOffset ExportedAt,
    IReadOnlyList<SavedCalculationResponse> SavedCalculations,
    IReadOnlyList<PasskeyResponse> Passkeys,
    KeyFigurePreferences KeyFigures,
    IReadOnlyList<UserSessionResponse> Sessions);
