using System.Buffers.Text;
using System.Formats.Cbor;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MortgageAnalytics.Api.IntegrationTests.Infrastructure;

/// <summary>
/// A passkey device in a few lines, so the API's whole ceremony can be tested without a browser: it keeps an ES256 key
/// pair, makes a credential from registration options ("none" attestation, like a platform passkey) and signs sign-in
/// options, exactly as the WebAuthn specification lays out. The browser test (a virtual authenticator) proves the real
/// thing works; this proves what the server accepts and, above all, refuses.
/// </summary>
public sealed class SoftwareAuthenticator
{
    private readonly ECDsa _key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    private byte[] _userHandle = [];

    /// <summary>The credential id this device chose.</summary>
    public byte[] CredentialId { get; } = RandomNumberGenerator.GetBytes(32);

    /// <summary>The site the device believes it is talking to; the API under test answers as <c>localhost</c>.</summary>
    public string Origin { get; set; } = "http://localhost";

    /// <summary>The counter it reports; real devices raise it at each sign-in.</summary>
    public uint Counter { get; set; }

    /// <summary>What the device sends as the user handle at sign-in; by default the one it was made for.</summary>
    public byte[]? UserHandleToSend { get; set; }

    private static string Base64(byte[] bytes) => Base64Url.EncodeToString(bytes);

    private byte[] RpIdHash => SHA256.HashData(Encoding.UTF8.GetBytes(new Uri(Origin).Host));

    private byte[] ClientData(string type, string challenge) =>
        Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { type, challenge, origin = Origin, crossOrigin = false }));

    /// <summary>Makes the credential the registration options ask for, as <c>PublicKeyCredential.toJSON()</c> would.</summary>
    public object Create(JsonElement options)
    {
        _userHandle = Base64Url.DecodeFromChars(options.GetProperty("user").GetProperty("id").GetString()!);

        var cose = new CborWriter(CborConformanceMode.Ctap2Canonical);
        var point = _key.ExportParameters(false).Q;
        cose.WriteStartMap(5);
        cose.WriteInt32(1); cose.WriteInt32(2); // key type: EC2
        cose.WriteInt32(3); cose.WriteInt32(-7); // algorithm: ES256
        cose.WriteInt32(-1); cose.WriteInt32(1); // curve: P-256
        cose.WriteInt32(-2); cose.WriteByteString(point.X!);
        cose.WriteInt32(-3); cose.WriteByteString(point.Y!);
        cose.WriteEndMap();

        // rpIdHash, flags (user present, user verified, attested credential data), counter, aaguid, credential id, key.
        var authenticatorData = RpIdHash
            .Concat(new byte[] { 0x45 })
            .Concat(BitConverter.GetBytes((uint)Counter).Reverse())
            .Concat(new byte[16])
            .Concat(new[] { (byte)(CredentialId.Length >> 8), (byte)CredentialId.Length })
            .Concat(CredentialId)
            .Concat(cose.Encode())
            .ToArray();

        var attestation = new CborWriter(CborConformanceMode.Ctap2Canonical);
        attestation.WriteStartMap(3);
        attestation.WriteTextString("fmt"); attestation.WriteTextString("none");
        attestation.WriteTextString("attStmt"); attestation.WriteStartMap(0); attestation.WriteEndMap();
        attestation.WriteTextString("authData"); attestation.WriteByteString(authenticatorData);
        attestation.WriteEndMap();

        return new
        {
            id = Base64(CredentialId), rawId = Base64(CredentialId), type = "public-key",
            response = new
            {
                attestationObject = Base64(attestation.Encode()),
                clientDataJSON = Base64(ClientData("webauthn.create", options.GetProperty("challenge").GetString()!)),
            },
            clientExtensionResults = new { },
        };
    }

    /// <summary>Signs the sign-in options' challenge, as <c>PublicKeyCredential.toJSON()</c> would give it.</summary>
    public object Get(JsonElement options)
    {
        var clientData = ClientData("webauthn.get", options.GetProperty("challenge").GetString()!);
        var authenticatorData = RpIdHash.Concat(new byte[] { 0x05 }).Concat(BitConverter.GetBytes(Counter).Reverse()).ToArray(); // user present and verified
        var signature = _key.SignData(authenticatorData.Concat(SHA256.HashData(clientData)).ToArray(), HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence);

        return new
        {
            id = Base64(CredentialId), rawId = Base64(CredentialId), type = "public-key",
            response = new
            {
                authenticatorData = Base64(authenticatorData), clientDataJSON = Base64(clientData), signature = Base64(signature),
                userHandle = Base64(UserHandleToSend ?? _userHandle),
            },
            clientExtensionResults = new { },
        };
    }
}
