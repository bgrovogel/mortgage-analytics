using System.Text.Json;

namespace MortgageAnalytics.Application.Contracts;

/// <summary>What a device needs to start a passkey ceremony, and the protected state to send back with its answer.</summary>
/// <param name="State">An opaque, signed and short-lived token that remembers the challenge; send it back unchanged.</param>
/// <param name="Options">The WebAuthn options for <c>navigator.credentials.create()</c> or <c>get()</c>, in their JSON form.</param>
public sealed record PasskeyCeremony(string State, JsonElement Options);

/// <summary>A device's answer to registration options, with the name to give the new passkey.</summary>
public sealed record RegisterPasskeyRequest
{
    /// <summary>What the user calls this passkey.</summary>
    /// <example>MacBook</example>
    public string Name { get; init; } = "";

    /// <summary>The <c>State</c> from the registration options.</summary>
    public string State { get; init; } = "";

    /// <summary>The credential the device made (<c>PublicKeyCredential.toJSON()</c>).</summary>
    public JsonElement Credential { get; init; }
}

/// <summary>A device's answer to sign-in options.</summary>
public sealed record SignInWithPasskeyRequest
{
    /// <summary>The <c>State</c> from the sign-in options.</summary>
    public string State { get; init; } = "";

    /// <summary>The assertion the device made (<c>PublicKeyCredential.toJSON()</c>).</summary>
    public JsonElement Credential { get; init; }
}

/// <summary>A passkey, as its owner sees it.</summary>
/// <param name="Id">Its credential id, base64url.</param>
/// <param name="Name">What the owner calls it.</param>
/// <param name="CreatedAt">When it was registered.</param>
/// <param name="LastUsedAt">When it last signed in; null until it has.</param>
public sealed record PasskeyResponse(string Id, string Name, DateTimeOffset CreatedAt, DateTimeOffset? LastUsedAt);
