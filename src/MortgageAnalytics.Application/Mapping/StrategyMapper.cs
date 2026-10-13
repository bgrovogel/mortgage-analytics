using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Application.Mapping;

/// <summary>Maps between the strategy contracts and the domain. Pure functions, no state.</summary>
public static class StrategyMapper
{
    /// <summary>The request as domain inputs.</summary>
    /// <param name="request">A validated request.</param>
    /// <param name="defaultNextPaymentDate">Used when the request gives no next payment date.</param>
    public static StrategyInputs ToInputs(this StrategyRequest request, DateOnly defaultNextPaymentDate) =>
        new(
            request.ToMortgage(defaultNextPaymentDate),
            request.HomeValue,
            request.HomeGrowthRate,
            new Household(
                request.GrossAnnualIncome,
                request.MarginalTaxRate,
                request.CapitalGainsTaxRate,
                ToDomain(request.FilingStatus),
                request.OtherItemizedDeductions,
                request.MonthlyCashToPutToWork,
                request.AnnualRsuVesting,
                request.SellRsusAtVest,
                request.AnnualEsopContribution,
                request.CurrentRetirementSavings,
                request.CurrentInvestments),
            new EmployerMatch(request.EmployerMatchPercent, request.MatchUpToPercentOfPay),
            new StockPurchasePlan(request.EsppContributionPercent, request.EsppDiscountPercent, request.EsppPurchasePeriodMonths),
            request.AnnualIraContribution,
            new MarketAssumptions(request.ExpectedAnnualReturn, request.InflationRate, ToDomain(request.RiskProfile)))
        {
            Buydown = request.Buydown.ToDomain(),
            Pmi = LoanPmi.OnCurrentLoan(request.MonthlyPmi, request.HomeValue),
        };

    /// <summary>The mortgage as it stands today, with an adjustable rate's expected resets.</summary>
    private static LoanTerms ToMortgage(this StrategyRequest request, DateOnly defaultNextPaymentDate)
    {
        var loan = new LoanTerms(request.CurrentBalance, request.AnnualInterestRate, request.RemainingTermInMonths, request.NextPaymentDate ?? defaultNextPaymentDate);
        return loan.WithAdjustableRate(request.AdjustableRate.ToDomain());
    }

    /// <summary>Maps the comparison to the response contract.</summary>
    /// <param name="comparison">The domain result.</param>
    /// <param name="inputs">The inputs it was run on (for the match and ESPP figures).</param>
    public static StrategyComparisonResponse ToResponse(this StrategyComparison comparison, StrategyInputs inputs)
    {
        var plan = comparison.Plan;
        var rates = comparison.Rates;
        return new StrategyComparisonResponse(
            ToContract(comparison.Recommended.Kind),
            ToContract(comparison.RunnerUp.Kind),
            comparison.Lead,
            comparison.LeadPercent,
            ToContract(comparison.WinnerIn(MarketScenarioKind.Expected).Kind),
            ToContract(comparison.WinnerIn(MarketScenarioKind.BadDecade).Kind),
            new MonthlyCashPlanResponse(plan.MortgagePayment, plan.RetirementContribution, plan.EmployerMatch,
                plan.RetirementContributionCost, plan.EsppContribution, plan.ExtraCash),
            new StrategyRatesResponse(
                rates.MortgageRate,
                rates.FirstYearInterest,
                rates.FirstYearTaxSaved,
                rates.StandardDeduction,
                rates.InterestIsDeducted,
                rates.AfterTaxMortgageRate,
                rates.ExpectedReturn,
                rates.RiskMargin,
                rates.RiskAdjustedReturn,
                rates.IraShelteredPercent,
                rates.TaxableAfterTaxReturn,
                rates.AfterTaxRiskAdjustedReturn,
                rates.RateEdge,
                MarketScenario.BadDecadeAnnualReturn,
                inputs.Match.Exists ? inputs.Match.MatchPercent : 0m,
                inputs.StockPurchasePlan.Exists ? inputs.StockPurchasePlan.GainPercent : 0m,
                rates.TargetInvestPercent,
                rates.AutomaticAnnualStock,
                rates.DiscretionaryAnnualCash,
                rates.HybridInvestPercent,
                rates.AverageMortgageRate,
                rates.BuydownSubsidy),
            [.. comparison.Outcomes.Select(o => new StrategyOutcomeResponse(
                ToContract(o.Kind), o.InvestPercent, ToResponse(o.Expected), ToResponse(o.RiskAdjusted), ToResponse(o.BadDecade)))]);
    }

    private static StrategyProjectionResponse ToResponse(StrategyProjection projection) =>
        new(
            projection.TotalInterest,
            projection.TotalTaxSaved,
            projection.PayoffMonth,
            projection.PayoffDate,
            projection.CrossoverMonth,
            projection.CrossoverDate,
            projection.TotalMortgageInsurance,
            projection.MortgageInsuranceEndDate,
            [.. projection.Years.Select(y => new NetWorthYearResponse(
                y.Year, y.HomeValue, y.MortgageBalance, y.HomeEquity, y.Investments, y.NetWorth, y.NetWorthInTodaysDollars))]);

    private static FilingStatus ToDomain(TaxFilingStatus status) => status switch
    {
        TaxFilingStatus.Single => FilingStatus.SingleFiler,
        TaxFilingStatus.MarriedFilingJointly => FilingStatus.MarriedFilingJointly,
        TaxFilingStatus.HeadOfHousehold => FilingStatus.HeadOfHousehold,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown filing status."),
    };

    private static RiskProfile ToDomain(InvestorRiskProfile profile) => profile switch
    {
        InvestorRiskProfile.Conservative => RiskProfile.Conservative,
        InvestorRiskProfile.Balanced => RiskProfile.Balanced,
        InvestorRiskProfile.Aggressive => RiskProfile.Aggressive,
        _ => throw new ArgumentOutOfRangeException(nameof(profile), profile, "Unknown risk profile."),
    };

    private static PayoffStrategy ToContract(StrategyKind kind) => kind switch
    {
        StrategyKind.PayOffFirst => PayoffStrategy.PayOffFirst,
        StrategyKind.InvestTheDifference => PayoffStrategy.InvestTheDifference,
        StrategyKind.Hybrid => PayoffStrategy.Hybrid,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown strategy."),
    };
}
