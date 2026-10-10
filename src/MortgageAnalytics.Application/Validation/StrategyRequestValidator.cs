using System.Linq.Expressions;
using FluentValidation;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Application.Validation;

/// <summary>
/// Field-level checks for a strategy comparison. Limits come from the domain (loan limits, tax-law limits),
/// so the API and the engine agree on what is valid (DRY).
/// </summary>
public sealed class StrategyRequestValidator : AbstractValidator<StrategyRequest>
{
    /// <summary>The longest remaining term accepted: the 30-year horizon.</summary>
    public const int MaxRemainingTermInMonths = StrategySimulator.HorizonInMonths;

    /// <summary>Defines every rule for a <see cref="StrategyRequest"/>.</summary>
    public StrategyRequestValidator()
    {
        RuleFor(r => r.CurrentBalance).GreaterThan(0).LessThanOrEqualTo(LoanTerms.MaxPrincipal).WholeCents().WithName("Mortgage balance");
        RuleFor(r => r.AnnualInterestRate).Percentage(max: LoanTerms.MaxAnnualInterestRate).WithName("Interest rate");
        RuleFor(r => r.RemainingTermInMonths).InclusiveBetween(1, MaxRemainingTermInMonths).WithName("Payments left");
        RuleFor(r => r.NextPaymentDate)
            .InclusiveBetween(AmortizationRequestValidator.EarliestFirstPayment, AmortizationRequestValidator.LatestFirstPayment)
            .WithName("Next payment date")
            .When(r => r.NextPaymentDate is not null);
        RuleFor(r => r.HomeValue).GreaterThanOrEqualTo(0).LessThanOrEqualTo(Household.MaxAmount).WholeCents().WithName("Home value");
        RuleFor(r => r.HomeGrowthRate).Rate(-20, 25).WithName("Home value growth");

        Amount(r => r.GrossAnnualIncome, "Gross income");
        Percent(r => r.MarginalTaxRate, Household.MaxTaxRate, "Tax rate");
        Percent(r => r.CapitalGainsTaxRate, Household.MaxTaxRate, "Capital gains tax rate");
        RuleFor(r => r.FilingStatus).IsInEnum().WithName("Filing status");
        Amount(r => r.OtherItemizedDeductions, "Other itemized deductions");
        Amount(r => r.MonthlyCashToPutToWork, "Monthly cash to put to work");

        Percent(r => r.EmployerMatchPercent, 200, "Employer match");
        Percent(r => r.MatchUpToPercentOfPay, 100, "Matched share of pay");
        Percent(r => r.EsppContributionPercent, 25, "ESPP contribution");
        Percent(r => r.EsppDiscountPercent, 15, "ESPP discount");
        RuleFor(r => r.EsppPurchasePeriodMonths).InclusiveBetween(1, 27).WithName("ESPP purchase period");
        RuleFor(r => r.AnnualIraContribution).InclusiveBetween(0, TaxLimits.IraContribution).WholeCents().WithName("IRA contribution");
        Amount(r => r.AnnualRsuVesting, "RSUs vesting");
        Amount(r => r.AnnualEsopContribution, "ESOP contribution");
        Amount(r => r.CurrentRetirementSavings, "Retirement savings");
        Amount(r => r.CurrentInvestments, "Current investments");

        RuleFor(r => r.ExpectedAnnualReturn).Rate(-10, 30).WithName("Expected return");
        RuleFor(r => r.InflationRate).Rate(-5, 20).WithName("Inflation");
        RuleFor(r => r.RiskProfile).IsInEnum().WithName("Risk profile");
    }

    private void Amount(Expression<Func<StrategyRequest, decimal>> field, string name) =>
        RuleFor(field).InclusiveBetween(0, Household.MaxAmount).WholeCents().WithName(name);

    private void Percent(Expression<Func<StrategyRequest, decimal>> field, decimal max, string name) =>
        RuleFor(field).Percentage(max).WithName(name);
}
