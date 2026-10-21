using FluentValidation;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Validation;

/// <summary>
/// A saved calculation needs a usable name, and one kind of inputs that would pass its own endpoint; other homes come
/// only with calculator inputs, up to four homes in all.
/// </summary>
public sealed class SaveCalculationRequestValidator : AbstractValidator<SaveCalculationRequest>
{
    /// <summary>The longest name accepted, after trimming.</summary>
    public const int MaxNameLength = 100;

    /// <summary>The longest note accepted, after trimming.</summary>
    public const int MaxNoteLength = 500;

    /// <summary>The most homes a comparison holds: the calculator inputs and three others.</summary>
    public const int MaxHomes = 4;

    /// <summary>Defines the rules; the inputs reuse each endpoint's own validator (DRY).</summary>
    public SaveCalculationRequestValidator()
    {
        RuleFor(r => r.Name)
            .Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Give the calculation a name.")
            .Must(name => name.Trim().Length <= MaxNameLength).WithMessage($"Keep the name to {MaxNameLength} characters or fewer.");

        RuleFor(r => r.Note)
            .Must(note => note is null || note.Trim().Length <= MaxNoteLength)
            .WithMessage($"Keep the note to {MaxNoteLength} characters or fewer.");

        RuleFor(r => r.Inputs)
            .Must((request, _) => KindsGiven(request) == 1)
            .WithMessage(r => KindsGiven(r) == 0
                ? "Include the calculator inputs, a refinance comparison or a pay-off-or-invest comparison to save."
                : "Include only one kind of inputs: calculator, refinance or pay-off-or-invest.");

        RuleFor(r => r.OtherHomes)
            .Cascade(CascadeMode.Stop)
            .Must((request, _) => request.Inputs is not null)
            .WithMessage("Other homes are compared with the calculator inputs: include those too.")
            .Must(homes => homes!.Count is > 0 and < MaxHomes)
            .WithMessage($"Compare up to {MaxHomes} homes: the calculator inputs and up to {MaxHomes - 1} more.")
            .When(r => r.OtherHomes is not null);

        RuleFor(r => r.Inputs!).SetValidator(new AmortizationRequestValidator()).When(r => r.Inputs is not null);
        RuleForEach(r => r.OtherHomes).SetValidator(new AmortizationRequestValidator()).When(r => r.OtherHomes is not null);
        RuleFor(r => r.Refinance!).SetValidator(new RefinanceRequestValidator()).When(r => r.Refinance is not null);
        RuleFor(r => r.Strategy!).SetValidator(new StrategyRequestValidator()).When(r => r.Strategy is not null);
    }

    private static int KindsGiven(SaveCalculationRequest request) =>
        (request.Inputs is null ? 0 : 1) + (request.Refinance is null ? 0 : 1) + (request.Strategy is null ? 0 : 1);
}
