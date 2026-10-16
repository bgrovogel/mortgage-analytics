using System.Buffers.Text;
using System.Text;
using System.Text.Json;
using Fido2NetLib;
using Fido2NetLib.Objects;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using MortgageAnalytics.Api.Filters;
using MortgageAnalytics.Api.Security;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Passkeys;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>
/// Passkeys: signing in with a key pair kept on the user's device, unlocked by its fingerprint, face or PIN, so there is
/// no password to guess, phish or reuse. Registering needs an account (the user is signed in); signing in does not. The
/// WebAuthn work (the challenge, the signature, the origin) is done by the Fido2 library; these endpoints only carry
/// its options and answers, and keep each passkey's public key.
/// </summary>
public static class PasskeyEndpoints
{
    /// <summary>The most passkeys one user can have: a few devices, not an unbounded table.</summary>
    public const int MaxPasskeysPerUser = 10;

    private const string Register = "register";
    private const string SignInPurpose = "sign-in";
    private const string SignInFailed = "That passkey could not sign you in. Try again, or sign in with your password.";

    /// <summary>Registers what passkeys need: the ceremony's sealed state.</summary>
    /// <param name="services">The container to add to.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddPasskeys(this IServiceCollection services) => services.AddSingleton<PasskeyState>();

    /// <summary>Maps the passkey endpoints under <c>/api/v1/account/passkeys</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapPasskeyEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/account/passkeys")
            .WithTags("Passkeys")
            .RequireRateLimiting(AccountEndpoints.AttemptsPolicy)
            .ProducesProblem(StatusCodes.Status500InternalServerError);

        group.MapGet("/", List)
            .RequireAuthorization()
            .WithName("ListPasskeys")
            .WithSummary("The signed-in user's passkeys.")
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapPost("/registration-options", RegistrationOptions)
            .RequireAuthorization()
            .WithName("PasskeyRegistrationOptions")
            .WithSummary("Start registering a passkey: the options for navigator.credentials.create(), and the state to send back.")
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapPost("/", RegisterPasskey)
            .RequireAuthorization()
            .AddEndpointFilter<ValidationFilter<RegisterPasskeyRequest>>()
            .WithName("RegisterPasskey")
            .WithSummary("Finish registering a passkey with the device's answer, under a name.")
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapDelete("/{id}", Delete)
            .RequireAuthorization()
            .WithName("DeletePasskey")
            .WithSummary("Remove one of the signed-in user's passkeys.")
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapPost("/sign-in-options", SignInOptions)
            .AllowAnonymous()
            .WithName("PasskeySignInOptions")
            .WithSummary("Start signing in with a passkey: the options for navigator.credentials.get(), and the state to send back.")
            .WithDescription("Needs no account name: the device offers the passkeys it holds for this site.");

        group.MapPost("/sign-in", SignIn)
            .AllowAnonymous()
            .WithName("PasskeySignIn")
            .WithSummary("Finish signing in with the device's answer; the response sets the session cookie.")
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        return routes;
    }

    private static async Task<Ok<IReadOnlyList<PasskeyResponse>>> List(System.Security.Claims.ClaimsPrincipal user, IPasskeyRepository passkeys, CancellationToken cancellationToken) =>
        TypedResults.Ok<IReadOnlyList<PasskeyResponse>>([.. (await passkeys.ListAsync(user.OwnerId(), cancellationToken)).Select(p => ToResponse(p))]);

    private static async Task<Results<Ok<PasskeyCeremony>, ProblemHttpResult>> RegistrationOptions(
        HttpContext http, UserManager<IdentityUser> users, IPasskeyRepository passkeys, PasskeyState state, CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(http.User);
        if (user is null)
            return TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Sign in first.");

        var existing = await passkeys.ListAsync(user.Id, cancellationToken);
        if (existing.Count >= MaxPasskeysPerUser)
            return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: $"You can have up to {MaxPasskeysPerUser} passkeys. Remove one to add another.");

        var options = Fido2For(http).RequestNewCredential(new RequestNewCredentialParams
        {
            User = new Fido2User { Id = Encoding.UTF8.GetBytes(user.Id), Name = user.Email!, DisplayName = user.Email! },
            ExcludeCredentials = [.. existing.Select(p => new PublicKeyCredentialDescriptor(p.CredentialId))],
            // A passkey the device can offer by itself at sign-in, so no account name is typed.
            AuthenticatorSelection = new AuthenticatorSelection { ResidentKey = ResidentKeyRequirement.Required, UserVerification = UserVerificationRequirement.Preferred },
            AttestationPreference = AttestationConveyancePreference.None,
        });

        return TypedResults.Ok(Ceremony(state.Protect(Register, user.Id, options.ToJson()), options.ToJson()));
    }

    private static async Task<Results<Created<PasskeyResponse>, ProblemHttpResult>> RegisterPasskey(
        RegisterPasskeyRequest request, HttpContext http, UserManager<IdentityUser> users, IPasskeyRepository passkeys, PasskeyState state, TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(http.User);
        if (user is null)
            return TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Sign in first.");

        var optionsJson = state.Unprotect(request.State, Register, user.Id);
        if (optionsJson is null)
            return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "That registration took too long or was not started here. Try again.");

        RegisteredPublicKeyCredential registered;
        try
        {
            registered = await Fido2For(http).MakeNewCredentialAsync(new MakeNewCredentialParams
            {
                AttestationResponse = JsonSerializer.Deserialize<AuthenticatorAttestationRawResponse>(request.Credential.GetRawText())!,
                OriginalOptions = CredentialCreateOptions.FromJson(optionsJson),
                IsCredentialIdUniqueToUserCallback = async (args, token) => await passkeys.FindAsync(args.CredentialId, token) is null,
            }, cancellationToken);
        }
        catch (Exception exception) when (exception is Fido2VerificationException or JsonException or ArgumentException)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "The device's answer could not be checked. Try again.");
        }

        var passkey = new Passkey
        {
            CredentialId = registered.Id, OwnerId = user.Id, PublicKey = registered.PublicKey, UserHandle = Encoding.UTF8.GetBytes(user.Id),
            SignCount = registered.SignCount, Name = request.Name.Trim(), CreatedAt = clock.GetUtcNow(),
        };
        await passkeys.AddAsync(passkey, cancellationToken);
        return TypedResults.Created($"/api/v1/account/passkeys/{Base64Url.EncodeToString(passkey.CredentialId)}", ToResponse(passkey));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> Delete(
        string id, System.Security.Claims.ClaimsPrincipal user, IPasskeyRepository passkeys, CancellationToken cancellationToken)
    {
        var credentialId = Decode(id);
        return credentialId is not null && await passkeys.DeleteAsync(user.OwnerId(), credentialId, cancellationToken)
            ? TypedResults.NoContent()
            : TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "There is no passkey with that id.");
    }

    private static Ok<PasskeyCeremony> SignInOptions(HttpContext http, PasskeyState state)
    {
        var options = Fido2For(http).GetAssertionOptions(new GetAssertionOptionsParams
        {
            AllowedCredentials = [], // the device offers its own for this site
            UserVerification = UserVerificationRequirement.Preferred,
        });

        return TypedResults.Ok(Ceremony(state.Protect(SignInPurpose, null, options.ToJson()), options.ToJson()));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> SignIn(
        SignInWithPasskeyRequest request, HttpContext http, UserManager<IdentityUser> users, SignInManager<IdentityUser> signIn, IPasskeyRepository passkeys,
        PasskeyState state, TimeProvider clock, CancellationToken cancellationToken)
    {
        var failed = TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: SignInFailed);
        var optionsJson = state.Unprotect(request.State, SignInPurpose, null);
        if (optionsJson is null)
            return failed;

        AuthenticatorAssertionRawResponse? assertion;
        try
        {
            assertion = JsonSerializer.Deserialize<AuthenticatorAssertionRawResponse>(request.Credential.GetRawText());
        }
        catch (JsonException)
        {
            return failed;
        }

        var passkey = assertion is null ? null : await passkeys.FindAsync(assertion.RawId, cancellationToken);
        if (passkey is null)
            return failed;

        try
        {
            var result = await Fido2For(http).MakeAssertionAsync(new MakeAssertionParams
            {
                AssertionResponse = assertion!,
                OriginalOptions = AssertionOptions.FromJson(optionsJson),
                StoredPublicKey = passkey.PublicKey,
                StoredSignatureCounter = passkey.SignCount,
                // The device names the user it holds this passkey for; it must be the one the passkey was made for.
                IsUserHandleOwnerOfCredentialIdCallback = (args, _) => Task.FromResult(args.UserHandle.AsSpan().SequenceEqual(passkey.UserHandle)),
            }, cancellationToken);
            await passkeys.RecordUseAsync(passkey.CredentialId, result.SignCount, clock.GetUtcNow(), cancellationToken);
        }
        catch (Exception exception) when (exception is Fido2VerificationException or ArgumentException)
        {
            return failed;
        }

        // The same standing as a password sign-in: a confirmed email, and not locked out.
        var user = await users.FindByIdAsync(passkey.OwnerId);
        if (user is null || !user.EmailConfirmed || await users.IsLockedOutAsync(user))
            return failed;

        await signIn.SignInAsync(user, isPersistent: true);
        return TypedResults.NoContent();
    }

    /// <summary>
    /// The library, set for the site the request came to: the passkey is for this domain, and the browser's own record of
    /// where it is must match it. (Behind a proxy, the believed forwarded headers give the public scheme and host.)
    /// </summary>
    private static Fido2 Fido2For(HttpContext http)
    {
        var request = http.Request;
        var configuration = http.RequestServices.GetRequiredService<IConfiguration>();
        return new Fido2(new Fido2Configuration
        {
            RPID = request.Host.Host,
            RPName = configuration["Passkeys:ServerName"] ?? "Mortgage Analytics",
            Origins = new HashSet<string> { $"{request.Scheme}://{request.Host}" },
        });
    }

    private static PasskeyCeremony Ceremony(string state, string optionsJson)
    {
        using var document = JsonDocument.Parse(optionsJson);
        return new PasskeyCeremony(state, document.RootElement.Clone());
    }

    private static PasskeyResponse ToResponse(Passkey passkey) =>
        new(Base64Url.EncodeToString(passkey.CredentialId), passkey.Name, passkey.CreatedAt, passkey.LastUsedAt);

    private static byte[]? Decode(string id) => Base64Url.IsValid(id) ? Base64Url.DecodeFromChars(id) : null;
}
