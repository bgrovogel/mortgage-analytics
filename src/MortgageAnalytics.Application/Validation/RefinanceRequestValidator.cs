using FluentValidation;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Validation;

/// <summary>
/// Field-level checks for a refinance comparison. Limits come from the domain's <see cref="LoanTerms"/>,
/// the same as the purchase calculator's (DRY).
/// </summary>
public sealed class RefinanceRequestValidator : AbstractValidator<RefinanceRequest>
{
    /// <summary>Defines every rule, checking an original loan against the system clock.</summary>
    public RefinanceRequestValidator() : this(TimeProvider.System)
    {
    }

    /// <summary>Defines every rule for a <see cref="RefinanceRequest"/>.</summary>
    /// <param name="clock">Today's date, to check that an original loan still has payments left.</param>
    public RefinanceRequestValidator(TimeProvider clock)
    {
        // The loan today is what is owed now, or the original loan; the server works out the one from the other.
        When(r => r.OriginalLoan is null, () =>
        {
            RuleFor(r => r.CurrentBalance)
                .GreaterThan(0)
                .LessThanOrEqualTo(LoanTerms.MaxPrincipal)
                .WholeCents()
                .WithName("Current balance");

            RuleFor(r => r.RemainingTermInMonths)
                .InclusiveBetween(1, LoanTerms.MaxTermInMonths)
                .WithName("Payments left");
        });

        RuleFor(r => r.OriginalLoan!).ChildRules(original =>
        {
            original.RuleFor(o => o.Amount).GreaterThan(0).LessThanOrEqualTo(LoanTerms.MaxPrincipal).WholeCents().WithName("Original loan amount");
            original.RuleFor(o => o.TermInMonths).InclusiveBetween(1, LoanTerms.MaxTermInMonths).WithName("Original term");
            original.RuleFor(o => o.FirstPaymentDate)
                .InclusiveBetween(AmortizationRequestValidator.EarliestFirstPayment, AmortizationRequestValidator.LatestFirstPayment)
                .WithName("First payment date");
            original.RuleFor(o => o)
                .Must(o => o.FirstPaymentDate.AddMonths(o.TermInMonths - 1) >= clock.Today())
                .WithMessage("The original loan is already paid off: its last payment is behind today.")
                .OverridePropertyName(nameof(OriginalLoanRequest.FirstPaymentDate))
                .When(o => o.TermInMonths is >= 1 and <= LoanTerms.MaxTermInMonths
                    && o.FirstPaymentDate >= AmortizationRequestValidator.EarliestFirstPayment
                    && o.FirstPaymentDate <= AmortizationRequestValidator.LatestFirstPayment);
        }).When(r => r.OriginalLoan is not null);

        RuleFor(r => r.CurrentAnnualInterestRate)
            .Percentage(max: LoanTerms.MaxAnnualInterestRate)
            .WithName("Current interest rate");

        // PMI on either loan is measured against the home's value, so it needs one.
        RuleFor(r => r.HomeValue!.Value).GreaterThan(0).LessThanOrEqualTo(LoanTerms.MaxPrincipal).WholeCents().WithName("Home value")
            .OverridePropertyName(nameof(RefinanceRequest.HomeValue))
            .When(r => r.HomeValue is not null);
        RuleFor(r => r.HomeValue).NotNull().WithMessage("Enter the home's value: PMI ends at 80% of it.").When(r => r.CurrentMonthlyPmi > 0);
        RuleFor(r => r.CurrentMonthlyPmi).InclusiveBetween(0, StrategyRequestValidator.MaxMonthlyPmi).WholeCents().WithName("PMI per month");
        RuleFor(r => r.NewPmiRate).Percentage(max: 5).WithName("New PMI rate");

        RuleFor(r => r.NextPaymentDate)
            .InclusiveBetween(AmortizationRequestValidator.EarliestFirstPayment, AmortizationRequestValidator.LatestFirstPayment)
            .WithName("Next payment date")
            .When(r => r.NextPaymentDate is not null);

        RuleFor(r => r.CurrentAdjustableRate!)
            .SetValidator(r => new AdjustableRateRequestValidator(r.OriginalLoan?.TermInMonths ?? r.RemainingTermInMonths, r.CurrentAnnualInterestRate))
            .When(r => r.CurrentAdjustableRate is not null);
        RuleFor(r => r.NewAdjustableRate!)
            .SetValidator(r => new AdjustableRateRequestValidator(r.NewTermInMonths, r.NewAnnualInterestRate))
            .When(r => r.NewAdjustableRate is not null);
        RuleFor(r => r.NewBuydown!)
            .SetValidator(new TemporaryBuydownRequestValidator())
            .When(r => r.NewBuydown is not null);
        RuleFor(r => r.NewAdjustableRate)
            .Null().WithMessage("Choose a buydown or an adjustable rate for the new loan, not both.")
            .When(r => r.NewBuydown is not null);

        RuleFor(r => r.NewAnnualInterestRate)
            .Percentage(max: LoanTerms.MaxAnnualInterestRate)
            .WithName("New interest rate");

        RuleFor(r => r.NewTermInMonths)
            .InclusiveBetween(1, LoanTerms.MaxTermInMonths)
            .WithName("New term");

        RuleFor(r => r.ClosingCosts)
            .GreaterThanOrEqualTo(0)
            .WholeCents()
            .WithName("Closing costs");

        // With an original loan, what is owed today is at most what was first borrowed, so that is the bound used.
        RuleFor(r => (r.OriginalLoan == null ? r.CurrentBalance : r.OriginalLoan.Amount) + r.ClosingCosts)
            .LessThanOrEqualTo(LoanTerms.MaxPrincipal)
            .WithMessage($"The new loan (balance plus financed closing costs) cannot exceed {LoanTerms.MaxPrincipal:N0}.")
            .OverridePropertyName(nameof(RefinanceRequest.ClosingCosts))
            .When(r => r.FinanceClosingCosts);
    }
}
