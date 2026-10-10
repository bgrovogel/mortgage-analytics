using FluentValidation;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Validation;

/// <summary>A saved calculation needs a usable name, and one kind of inputs that would pass its own endpoint.</summary>
public sealed class SaveCalculationRequestValidator : AbstractValidator<SaveCalculationRequest>
{
    /// <summary>The longest name accepted, after trimming.</summary>
    public const int MaxNameLength = 100;

    /// <summary>Defines the rules; the inputs reuse the calculator's and the refinance validators (DRY).</summary>
    public SaveCalculationRequestValidator()
    {
        RuleFor(r => r.Name)
            .Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Give the calculation a name.")
            .Must(name => name.Trim().Length <= MaxNameLength).WithMessage($"Keep the name to {MaxNameLength} characters or fewer.");

        RuleFor(r => r.Inputs)
            .Must((request, inputs) => (inputs is null) != (request.Refinance is null))
            .WithMessage(r => r.Inputs is null
                ? "Include the calculator inputs or the refinance comparison to save."
                : "Include either calculator inputs or refinance inputs, not both.");

        RuleFor(r => r.Inputs!).SetValidator(new AmortizationRequestValidator()).When(r => r.Inputs is not null);
        RuleFor(r => r.Refinance!).SetValidator(new RefinanceRequestValidator()).When(r => r.Refinance is not null);
    }
}
