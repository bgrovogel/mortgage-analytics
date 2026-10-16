using FluentValidation;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Validation;

/// <summary>Registering a passkey needs a name to tell it apart by, and the ceremony's answer; the library checks the answer itself.</summary>
public sealed class RegisterPasskeyRequestValidator : AbstractValidator<RegisterPasskeyRequest>
{
    /// <summary>The longest name a passkey can be given, after trimming.</summary>
    public const int MaxNameLength = 50;

    /// <summary>The most characters the ceremony's protected state or answer can take: far more than any real one.</summary>
    public const int MaxCeremonyLength = 16_384;

    /// <summary>Defines the rules.</summary>
    public RegisterPasskeyRequestValidator()
    {
        RuleFor(r => r.Name)
            .Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Give the passkey a name.")
            .Must(name => name.Trim().Length <= MaxNameLength).WithMessage($"Keep the name to {MaxNameLength} characters or fewer.");
        RuleFor(r => r.State).NotEmpty().MaximumLength(MaxCeremonyLength);
    }
}
