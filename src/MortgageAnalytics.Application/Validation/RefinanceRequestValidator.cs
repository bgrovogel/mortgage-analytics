using FluentValidation;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Validation;

/// <summary>
/// Field-level checks for a refinance comparison. Limits come from the domain's <see cref="LoanTerms"/>,
/// the same as the purchase calculator's (DRY).
/// </summary>
public sealed class RefinanceRequestValidator : AbstractValidator<RefinanceRequest>
{
    /// <summary>Defines every rule for a <see cref="RefinanceRequest"/>.</summary>
    public RefinanceRequestValidator()
    {
        RuleFor(r => r.CurrentBalance)
            .GreaterThan(0)
            .LessThanOrEqualTo(LoanTerms.MaxPrincipal)
            .WholeCents()
            .WithName("Current balance");

        RuleFor(r => r.CurrentAnnualInterestRate)
            .Percentage(max: LoanTerms.MaxAnnualInterestRate)
            .WithName("Current interest rate");

        RuleFor(r => r.RemainingTermInMonths)
            .InclusiveBetween(1, LoanTerms.MaxTermInMonths)
            .WithName("Payments left");

        RuleFor(r => r.NextPaymentDate)
            .InclusiveBetween(AmortizationRequestValidator.EarliestFirstPayment, AmortizationRequestValidator.LatestFirstPayment)
            .WithName("Next payment date")
            .When(r => r.NextPaymentDate is not null);

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

        RuleFor(r => r.CurrentBalance + r.ClosingCosts)
            .LessThanOrEqualTo(LoanTerms.MaxPrincipal)
            .WithMessage($"The new loan (balance plus financed closing costs) cannot exceed {LoanTerms.MaxPrincipal:N0}.")
            .OverridePropertyName(nameof(RefinanceRequest.ClosingCosts))
            .When(r => r.FinanceClosingCosts);
    }
}
