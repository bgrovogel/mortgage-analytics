using System.Text.RegularExpressions;
using FluentValidation;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Validation;

/// <summary>
/// A key-figure arrangement is a short list of short lowercase names, each once. The API does not know the page's
/// figures, so it keeps only what could not be anything else.
/// </summary>
public sealed partial class KeyFigurePreferencesValidator : AbstractValidator<KeyFigurePreferences>
{
    /// <summary>The most figures in either list: the page has a handful.</summary>
    public const int MaxFigures = 20;

    /// <summary>The longest figure name.</summary>
    public const int MaxNameLength = 32;

    [GeneratedRegex("^[a-z][a-z0-9-]*$")]
    private static partial Regex Name();

    /// <summary>Defines the rules.</summary>
    public KeyFigurePreferencesValidator()
    {
        RuleFor(p => p.Order).NotNull().WithMessage("Give the order, empty for none.").DependentRules(() => RuleFor(p => p.Order).Must(Unique).WithMessage("A figure can be in the order once.").Must(Few).WithMessage($"Keep the order to {MaxFigures} figures or fewer."));
        RuleFor(p => p.Hidden).NotNull().WithMessage("Give the hidden figures, empty for none.").DependentRules(() => RuleFor(p => p.Hidden).Must(Unique).WithMessage("A figure can be put away once.").Must(Few).WithMessage($"Keep the hidden figures to {MaxFigures} or fewer."));
        RuleForEach(p => p.Order).Must(IsAName).WithMessage("A figure's name is a short lowercase word.").When(p => p.Order is not null);
        RuleForEach(p => p.Hidden).Must(IsAName).WithMessage("A figure's name is a short lowercase word.").When(p => p.Hidden is not null);
    }

    private static bool Unique(IReadOnlyList<string> names) => names.Distinct().Count() == names.Count;

    private static bool Few(IReadOnlyList<string> names) => names.Count <= MaxFigures;

    private static bool IsAName(string? name) => name is not null && name.Length <= MaxNameLength && Name().IsMatch(name);
}
