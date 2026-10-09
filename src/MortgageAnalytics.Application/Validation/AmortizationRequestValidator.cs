using FluentValidation;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Validation;

/// <summary>
/// Turns bad input into field-level messages before it reaches the domain.
/// Limits come from the domain types, so the API and the domain cannot disagree (DRY).
/// </summary>
/// <remarks>
/// An extra payment larger than the whole loan is always a mistake, so it is rejected here.
/// Whether an extra payment exceeds the balance <i>at that point</i> depends on the schedule,
/// so the engine caps it instead.
/// </remarks>
public sealed class AmortizationRequestValidator : AbstractValidator<AmortizationRequest>
{
    /// <summary>The most lump sums one request may contain.</summary>
    public const int MaxLumpSums = 120;

    // Keeps the last due date (up to 600 months out) well inside DateOnly's range.
    private static readonly DateOnly EarliestFirstPayment = new(1900, 1, 1);
    private static readonly DateOnly LatestFirstPayment = new(2200, 12, 31);

    /// <summary>Defines every rule for an <see cref="AmortizationRequest"/>.</summary>
    public AmortizationRequestValidator()
    {
        RuleFor(r => r.HomePrice)
            .GreaterThan(0)
            .WholeCents();

        RuleFor(r => r.DownPayment)
            .GreaterThanOrEqualTo(0)
            .LessThan(r => r.HomePrice).WithMessage("Down payment must be less than the home price.")
            .WholeCents();

        RuleFor(r => r.HomePrice - r.DownPayment)
            .LessThanOrEqualTo(LoanTerms.MaxPrincipal)
            .WithMessage($"The loan amount (home price minus down payment) cannot exceed {LoanTerms.MaxPrincipal:N0}.")
            .OverridePropertyName(nameof(AmortizationRequest.DownPayment));

        RuleFor(r => r.AnnualInterestRate)
            .InclusiveBetween(0, LoanTerms.MaxAnnualInterestRate)
            .PrecisionScale(6, 4, ignoreTrailingZeros: true);

        RuleFor(r => r.TermInMonths)
            .InclusiveBetween(1, LoanTerms.MaxTermInMonths);

        RuleFor(r => r.FirstPaymentDate)
            .InclusiveBetween(EarliestFirstPayment, LatestFirstPayment)
            .When(r => r.FirstPaymentDate is not null);

        RuleFor(r => r.Strategy).IsInEnum();

        RuleFor(r => r.Recast!)
            .SetValidator(new RecastTermsValidator())
            .When(r => r.Recast is not null);

        RuleFor(r => r.ExtraPayments!)
            .SetValidator(r => new ExtraPaymentsValidator(r.HomePrice - r.DownPayment, r.TermInMonths))
            .When(r => r.ExtraPayments is not null);

        RuleFor(r => r.HousingCosts!)
            .SetValidator(new HousingCostsValidator())
            .When(r => r.HousingCosts is not null);
    }

    private sealed class RecastTermsValidator : AbstractValidator<RecastTermsRequest>
    {
        public RecastTermsValidator()
        {
            RuleFor(r => r.MinimumLumpSum).GreaterThanOrEqualTo(0).WholeCents();
            RuleFor(r => r.Fee).InclusiveBetween(0, 10_000).WholeCents();
        }
    }

    private sealed class ExtraPaymentsValidator : AbstractValidator<ExtraPaymentsRequest>
    {
        public ExtraPaymentsValidator(decimal loanAmount, int termInMonths)
        {
            RuleFor(e => e.MonthlyAmount).ExtraAmount(loanAmount, allowZero: true);
            RuleFor(e => e.MonthlyStartingPaymentNumber).PaymentNumberWithin(termInMonths);

            RuleFor(e => e.Annual!.Amount)
                .ExtraAmount(loanAmount, allowZero: true)
                .OverridePropertyName("Annual.Amount").WithName("Annual extra payment")
                .When(e => e.Annual is not null);

            RuleFor(e => e.Annual!.FirstPaymentNumber)
                .PaymentNumberWithin(termInMonths)
                .OverridePropertyName("Annual.FirstPaymentNumber").WithName("Annual extra starting payment")
                .When(e => e.Annual is not null);

            RuleFor(e => e.LumpSums)
                .NotNull()
                .Must(l => l.Count <= MaxLumpSums).WithMessage($"No more than {MaxLumpSums} lump sums are allowed.");

            RuleForEach(e => e.LumpSums).ChildRules(lumpSum =>
            {
                lumpSum.RuleFor(l => l.Amount).ExtraAmount(loanAmount, allowZero: false);
                lumpSum.RuleFor(l => l.PaymentNumber).PaymentNumberWithin(termInMonths);
            });
        }
    }

    private sealed class HousingCostsValidator : AbstractValidator<HousingCostsRequest>
    {
        public HousingCostsValidator()
        {
            RuleFor(h => h.SchoolTaxRate).Percentage(max: 10);
            RuleFor(h => h.PropertyTaxRate).Percentage(max: 10);
            RuleFor(h => h.MudTaxRate).Percentage(max: 5);
            RuleFor(h => h.SchoolHomesteadExemption).InclusiveBetween(0, 10_000_000).WholeCents();
            RuleFor(h => h.LocalHomesteadExemptionPercent).Percentage(max: 100);
            RuleFor(h => h.HomesteadAssessmentCap).Percentage(max: 100);
            RuleFor(h => h.HomeValueGrowthRate).InclusiveBetween(-20, 25).PrecisionScale(6, 4, ignoreTrailingZeros: true);
            RuleFor(h => h.InsuranceIncreaseRate).InclusiveBetween(-20, 50).PrecisionScale(6, 4, ignoreTrailingZeros: true);
            RuleFor(h => h.HoaIncreaseRate).InclusiveBetween(-20, 50).PrecisionScale(6, 4, ignoreTrailingZeros: true);
            RuleFor(h => h.PmiRate).Percentage(max: 5);
            RuleFor(h => h.PmiCancellation).IsInEnum();
            RuleFor(h => h.AnnualHomeownersInsurance).InclusiveBetween(0, 1_000_000).WholeCents();
            RuleFor(h => h.MonthlyHoaDues).InclusiveBetween(0, 100_000).WholeCents();

            RuleFor(h => h.Pid!.AnnualAssessment)
                .InclusiveBetween(0, 1_000_000).WholeCents()
                .OverridePropertyName("Pid.AnnualAssessment").WithName("PID annual assessment")
                .When(h => h.Pid is not null);

            RuleFor(h => h.Pid!.RemainingYears)
                .InclusiveBetween(1, 50)
                .OverridePropertyName("Pid.RemainingYears").WithName("PID remaining years")
                .When(h => h.Pid?.RemainingYears is not null);
        }
    }
}

/// <summary>Reusable rule fragments, so each rule is written once (DRY).</summary>
internal static class SharedRules
{
    /// <summary>Rejects amounts with fractions of a cent.</summary>
    public static IRuleBuilderOptions<T, decimal> WholeCents<T>(this IRuleBuilder<T, decimal> rule) =>
        rule.PrecisionScale(15, 2, ignoreTrailingZeros: true).WithMessage("'{PropertyName}' cannot include fractions of a cent.");

    /// <summary>Requires a percentage between 0 and <paramref name="max"/>, with up to four decimal places.</summary>
    public static IRuleBuilderOptions<T, decimal> Percentage<T>(this IRuleBuilder<T, decimal> rule, decimal max) =>
        rule.InclusiveBetween(0, max).PrecisionScale(6, 4, ignoreTrailingZeros: true);

    /// <summary>Requires an extra payment that is not negative (or, unless <paramref name="allowZero"/>, positive), no larger than the loan, and in whole cents.</summary>
    public static IRuleBuilderOptions<T, decimal> ExtraAmount<T>(this IRuleBuilder<T, decimal> rule, decimal loanAmount, bool allowZero)
    {
        var floor = allowZero ? rule.GreaterThanOrEqualTo(0) : rule.GreaterThan(0);

        return floor
            .LessThanOrEqualTo(loanAmount).WithMessage("'{PropertyName}' cannot exceed the loan amount.")
            .WholeCents();
    }

    /// <summary>Requires a payment number between 1 and the loan term.</summary>
    public static IRuleBuilderOptions<T, int> PaymentNumberWithin<T>(this IRuleBuilder<T, int> rule, int termInMonths) =>
        rule.InclusiveBetween(1, Math.Max(1, termInMonths))
            .WithMessage($"'{{PropertyName}}' must be between 1 and the loan term ({termInMonths}).");
}
