using FluentValidation;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Validation;

/// <summary>
/// Checks an adjustable rate the same way wherever a loan can have one (the calculator, either loan in a refinance,
/// the mortgage in pay off or invest).
/// </summary>
internal sealed class AdjustableRateRequestValidator : AbstractValidator<AdjustableRateRequest>
{
    /// <summary>Defines the rules.</summary>
    /// <param name="termInMonths">The loan's term (or payments left): the first reset must come before it ends.</param>
    /// <param name="startingRate">The rate it starts at: the margin, as its floor, can be no higher.</param>
    public AdjustableRateRequestValidator(int termInMonths, decimal startingRate)
    {
        RuleFor(a => a.InitialFixedMonths)
            .InclusiveBetween(1, Math.Max(1, termInMonths - 1))
            .WithMessage($"The fixed period must be at least one payment and end before the loan does (payment {termInMonths}).")
            .WithName("Fixed period");
        RuleFor(a => a.AdjustmentIntervalMonths).InclusiveBetween(1, 120).WithName("Reset interval");
        RuleFor(a => a.ExpectedRate).Percentage(max: LoanTerms.MaxAnnualInterestRate).WithName("Expected rate");
        RuleFor(a => a.InitialCap).Percentage(max: AdjustableRate.MaxCap).WithName("First reset cap");
        RuleFor(a => a.PeriodicCap).Percentage(max: AdjustableRate.MaxCap).WithName("Later reset cap");
        RuleFor(a => a.LifetimeCap).Percentage(max: AdjustableRate.MaxCap).WithName("Lifetime cap");
        RuleFor(a => a.Margin!.Value)
            .Percentage(max: LoanTerms.MaxAnnualInterestRate)
            .LessThanOrEqualTo(startingRate).WithMessage("The margin is the rate's floor, so it can be no higher than the starting rate.")
            .OverridePropertyName(nameof(AdjustableRateRequest.Margin))
            .WithName("Margin")
            .When(a => a.Margin is not null);
    }
}

/// <summary>Checks a temporary buydown the same way wherever a loan can have one.</summary>
internal sealed class TemporaryBuydownRequestValidator : AbstractValidator<TemporaryBuydownRequest>
{
    /// <summary>Defines the rules.</summary>
    public TemporaryBuydownRequestValidator()
    {
        RuleFor(b => b.YearlyReductions)
            .Must(years => years.Count is >= 1 and <= TemporaryBuydown.MaxYears)
            .WithMessage($"A buydown covers 1 to {TemporaryBuydown.MaxYears} years.");
        RuleForEach(b => b.YearlyReductions)
            .GreaterThan(0)
            .LessThanOrEqualTo(TemporaryBuydown.MaxReduction)
            .PrecisionScale(6, 4, ignoreTrailingZeros: true)
            .WithName("Buydown reduction");
    }
}
