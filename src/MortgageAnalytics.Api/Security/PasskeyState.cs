using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace MortgageAnalytics.Api.Security;

/// <summary>
/// The challenge of a passkey ceremony, kept in the token the device carries back, rather than on the server: signed
/// and encrypted with the app's data-protection keys (the ones every instance shares), good for a few minutes, and bound
/// to what it is for (registering or signing in) and, when registering, to the user. So no instance needs to remember
/// anything between the two requests, and a token cannot be used for the other ceremony or by another user. Each is
/// opened once: an answer sent a second time is refused (by the instance that saw the first; a device whose counter
/// goes up is refused by every instance).
/// </summary>
public sealed class PasskeyState(IDataProtectionProvider protection, TimeProvider clock)
{
    /// <summary>How long a ceremony may take, from its options to its answer.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    private readonly ITimeLimitedDataProtector _protector = protection.CreateProtector("MortgageAnalytics.Passkeys.v1").ToTimeLimitedDataProtector();

    /// <summary>The tokens already opened, until they would have expired anyway.</summary>
    private readonly ConcurrentDictionary<string, DateTimeOffset> _opened = new();

    /// <summary>What a token holds.</summary>
    private sealed record Payload(string Purpose, string? UserId, string Options);

    /// <summary>Seals the options of a ceremony into a token.</summary>
    /// <param name="purpose">What it is for: <c>register</c> or <c>sign-in</c>.</param>
    /// <param name="userId">The user registering; null when signing in, since nobody is known yet.</param>
    /// <param name="optionsJson">The options the library made, whose challenge must come back.</param>
    /// <returns>The token.</returns>
    public string Protect(string purpose, string? userId, string optionsJson) =>
        _protector.Protect(JsonSerializer.Serialize(new Payload(purpose, userId, optionsJson)), Lifetime);

    /// <summary>Opens a token made by <see cref="Protect"/>, once, if it is still good and was made for this purpose and user.</summary>
    /// <param name="state">The token a device sent back.</param>
    /// <param name="purpose">What the ceremony being answered is for.</param>
    /// <param name="userId">The user answering; null when signing in.</param>
    /// <returns>The options it holds, or null when the token is forged, expired, for something else or already used.</returns>
    public string? Unprotect(string state, string purpose, string? userId)
    {
        try
        {
            var payload = JsonSerializer.Deserialize<Payload>(_protector.Unprotect(state));
            return payload is not null && payload.Purpose == purpose && payload.UserId == userId && FirstOpening(state) ? payload.Options : null;
        }
        catch (Exception exception) when (exception is CryptographicException or JsonException)
        {
            return null;
        }
    }

    /// <summary>True the first time a token is opened; false after that. Forgets tokens that have expired.</summary>
    private bool FirstOpening(string state)
    {
        var now = clock.GetUtcNow();
        foreach (var expired in _opened.Where(o => o.Value < now).Select(o => o.Key))
            _opened.TryRemove(expired, out _);

        return _opened.TryAdd(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(state))), now + Lifetime);
    }
}
