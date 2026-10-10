using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Strategies;

/// <summary>
/// Where each month's cash goes before any strategy chooses: the required mortgage payment, then free money.
/// Every strategy captures the full 401(k) match and the ESPP discount first, because both are near-certain
/// returns no mortgage rate can match. Only <see cref="ExtraCash"/> is left for a strategy to direct.
/// </summary>
/// <param name="MortgagePayment">The required principal-and-interest payment.</param>
/// <param name="RetirementContribution">The pre-tax 401(k) contribution that earns the full match.</param>
/// <param name="EmployerMatch">What the employer adds.</param>
/// <param name="RetirementContributionCost">What the contribution costs in take-home pay: it is pre-tax, so less than the contribution.</param>
/// <param name="EsppContribution">Take-home pay set aside for the stock purchase plan.</param>
/// <param name="ExtraCash">What is left for the strategy: extra principal, investing, or a split.</param>
public sealed record MonthlyCashPlan(
    decimal MortgagePayment,
    decimal RetirementContribution,
    decimal EmployerMatch,
    decimal RetirementContributionCost,
    decimal EsppContribution,
    decimal ExtraCash)
{
    /// <summary>Works out the monthly plan. Free money comes first, but never more than the cash available.</summary>
    /// <param name="inputs">The comparison's inputs.</param>
    public static MonthlyCashPlan For(StrategyInputs inputs)
    {
        var mortgage = inputs.Mortgage;
        var payment = PaymentFormula.MonthlyPayment(mortgage.Principal, mortgage.MonthlyRate, mortgage.TermInMonths);
        var household = inputs.Household;
        var available = household.MonthlyCashToPutToWork;

        // 401(k): enough to earn the whole match, within the legal limit and what take-home pay can cover.
        var contribution = 0m;
        if (inputs.Match.Exists && household.AfterTaxShare > 0)
        {
            var forFullMatch = Math.Min(household.GrossAnnualIncome * inputs.Match.UpToPercentOfPay / 100m, TaxLimits.EmployeeDeferral) / 12m;
            contribution = Money.Round(Math.Min(forFullMatch, available / household.AfterTaxShare));
        }
        var cost = Math.Min(Money.Round(contribution * household.AfterTaxShare), available);
        var match = Money.Round(contribution * inputs.Match.MatchPercent / 100m);

        // ESPP: the chosen share of pay, within the yearly purchase limit and the cash left.
        var espp = 0m;
        var plan = inputs.StockPurchasePlan;
        if (plan.Exists)
        {
            var chosen = household.GrossAnnualIncome * plan.ContributionPercentOfPay / 100m / 12m;
            var legalLimit = TaxLimits.EsppPurchases * (100m - plan.DiscountPercent) / 100m / 12m;
            espp = Math.Min(Money.Round(Math.Min(chosen, legalLimit)), available - cost);
        }

        return new MonthlyCashPlan(payment, contribution, match, cost, espp, available - cost - espp);
    }
}
