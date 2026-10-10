using FluentValidation;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Validation;

/// <summary>A saved calculation needs a usable name, and inputs that would pass the calculate endpoint.</summary>
public sealed class SaveCalculationRequestValidator : AbstractValidator<SaveCalculationRequest>
{
    /// <summary>The longest name accepted, after trimming.</summary>
    public const int MaxNameLength = 100;

    /// <summary>Defines the rules; the inputs reuse <see cref="AmortizationRequestValidator"/> (DRY).</summary>
    public SaveCalculationRequestValidator()
    {
        RuleFor(r => r.Name)
            .Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Give the calculation a name.")
            .Must(name => name.Trim().Length <= MaxNameLength).WithMessage($"Keep the name to {MaxNameLength} characters or fewer.");

        RuleFor(r => r.Inputs)
            .NotNull().WithMessage("Include the calculator inputs to save.")
            .SetValidator(new AmortizationRequestValidator()!);
    }
}
