using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Strategies;

/// <summary>
/// The rates behind the comparison: what paying down the mortgage is guaranteed to earn, what the market
/// can be counted on to earn, and the split of extra cash the hybrid strategy takes from them.
/// </summary>
/// <param name="MortgageRate">The mortgage's rate, as a percentage.</param>
/// <param name="FirstYearInterest">Interest paid in the first year at the required payment.</param>
/// <param name="FirstYearTaxSaved">Tax that interest saves in the first year: zero when the standard deduction is larger.</param>
/// <param name="StandardDeduction">The household's standard deduction.</param>
/// <param name="InterestIsDeducted">True when itemizing beats the standard deduction, so each extra dollar of interest lowers tax.</param>
/// <param name="AfterTaxMortgageRate">What a dollar of extra principal is guaranteed to earn, after tax: the mortgage rate, less the tax it saves if deducted.</param>
/// <param name="ExpectedReturn">The expected market return, as a percentage. An average, never a guarantee.</param>
/// <param name="RiskMargin">Points taken off for the risk profile.</param>
/// <param name="RiskAdjustedReturn">The expected return minus the risk margin: strategies are ranked on this.</param>
/// <param name="IraShelteredPercent">The share of the extra cash that fits in the IRA each year, where it grows tax-free.</param>
/// <param name="TaxableAfterTaxReturn">The risk-adjusted return in a taxable account, a year, after the capital gains tax paid on selling at the end of the mortgage.</param>
/// <param name="AfterTaxRiskAdjustedReturn">What invested extra cash earns after tax: the IRA share at the full risk-adjusted return, the rest at <paramref name="TaxableAfterTaxReturn"/>.</param>
/// <param name="TargetInvestPercent">The share of all new savings the hybrid aims to put in the market, from the rate difference.</param>
/// <param name="AutomaticAnnualStock">What goes into stock each year anyway (RSUs kept as shares, ESOP), counted toward that share.</param>
/// <param name="DiscretionaryAnnualCash">The extra cash a strategy directs each year.</param>
/// <param name="HybridInvestPercent">The share of extra cash the hybrid invests; the rest goes to principal.</param>
/// <param name="AverageMortgageRate">The mortgage's rate averaged over its payments left: its rate, unless it adjusts. Paying down earns this.</param>
/// <param name="BuydownSubsidy">What a buydown's subsidy pays of the payments, in all; 0 without one.</param>
public sealed record StrategyRates(
    decimal MortgageRate,
    decimal FirstYearInterest,
    decimal FirstYearTaxSaved,
    decimal StandardDeduction,
    bool InterestIsDeducted,
    decimal AfterTaxMortgageRate,
    decimal ExpectedReturn,
    decimal RiskMargin,
    decimal RiskAdjustedReturn,
    decimal IraShelteredPercent,
    decimal TaxableAfterTaxReturn,
    decimal AfterTaxRiskAdjustedReturn,
    decimal TargetInvestPercent,
    decimal AutomaticAnnualStock,
    decimal DiscretionaryAnnualCash,
    decimal HybridInvestPercent,
    decimal AverageMortgageRate,
    decimal BuydownSubsidy)
{
    /// <summary>How much more the market is counted on to earn than paying down the mortgage, after tax, in points. Negative when the mortgage wins.</summary>
    public decimal RateEdge => AfterTaxRiskAdjustedReturn - AfterTaxMortgageRate;

    /// <summary>
    /// Works out the rates and the hybrid's split.
    /// </summary>
    /// <remarks>
    /// The market's after-tax return is what the extra cash would really earn: the IRA share tax-free, the rest
    /// taxed once on selling, at the end of the mortgage (when the choice stops mattering). The hybrid starts from the rate difference: equal after-tax rates split new savings 50/50, and each
    /// point of edge moves the split 25 points, so a 2-point edge either way takes it all. The split is for all
    /// new savings, so stock that arrives anyway (RSUs kept, ESOP) counts toward the market's share first: someone
    /// already receiving plenty of stock puts more of their extra cash on the mortgage, the diversified choice.
    /// </remarks>
    /// <param name="inputs">The comparison's inputs.</param>
    /// <param name="plan">The monthly cash plan.</param>
    public static StrategyRates For(StrategyInputs inputs, MonthlyCashPlan plan)
    {
        var loan = inputs.Mortgage;
        var household = inputs.Household;
        var market = inputs.Market;

        var firstYearInterest = FirstYearInterestOf(inputs);
        // Paying down a loan whose rate adjusts earns its rate month by month: on average, the rate over its payments left.
        var averageRate = Percent(Enumerable.Range(1, loan.TermInMonths).Sum(loan.AnnualRateFor) / loan.TermInMonths);
        var deductible = TaxDeductions.DeductibleInterest(firstYearInterest, loan.Principal);
        var standard = TaxDeductions.StandardDeduction(household.FilingStatus);
        var deducted = household.OtherItemizedDeductions + deductible > standard;
        var afterTaxMortgage = deducted ? Percent(averageRate * household.AfterTaxShare) : averageRate;

        var automatic = household.AnnualAutomaticStock;
        var discretionary = 12m * (plan.ExtraCash + plan.EsppContribution) + (household.SellRsusAtVest ? household.AnnualRsuVesting : 0m);

        // Invested extra cash fills the IRA first, where it grows tax-free; the rest is taxed only when sold.
        var riskAdjusted = market.RiskAdjustedReturn;
        var sheltered = discretionary == 0 ? 100m : Math.Round(Math.Min(1m, inputs.AnnualIraContribution / discretionary) * 100m, MidpointRounding.AwayFromZero);
        var taxable = ReturnKeptAfterSaleTax(riskAdjusted, household.CapitalGainsTaxRate, loan.TermInMonths / 12m);
        var afterTaxMarket = Percent((sheltered * riskAdjusted + (100m - sheltered) * taxable) / 100m);
        var target = Math.Clamp(Math.Round(50m + 25m * (afterTaxMarket - afterTaxMortgage), MidpointRounding.AwayFromZero), 0m, 100m);
        var hybrid = discretionary == 0
            ? target
            : Math.Clamp(Math.Round((target / 100m * (automatic + discretionary) - automatic) / discretionary * 100m, MidpointRounding.AwayFromZero), 0m, 100m);

        return new StrategyRates(
            loan.AnnualInterestRate,
            firstYearInterest,
            TaxDeductions.TaxSavedByInterest(household, deductible),
            standard,
            deducted,
            afterTaxMortgage,
            market.ExpectedAnnualReturn,
            market.RiskProfile.MarginInPoints(),
            riskAdjusted,
            sheltered,
            taxable,
            afterTaxMarket,
            target,
            automatic,
            discretionary,
            hybrid,
            averageRate,
            BuydownSubsidyOf(inputs));
    }

    /// <summary>What a buydown's subsidy pays over its years, on the scheduled payment.</summary>
    private static decimal BuydownSubsidyOf(StrategyInputs inputs)
    {
        if (inputs.Buydown is not { } buydown) return 0m;
        var loan = inputs.Mortgage;
        var payment = PaymentFormula.MonthlyPayment(loan.Principal, loan.MonthlyRate, loan.TermInMonths);
        return Enumerable.Range(1, Math.Min(12 * buydown.YearlyReductions.Count, loan.TermInMonths)).Sum(m => buydown.SubsidyFor(loan, m, payment));
    }

    private static decimal FirstYearInterestOf(StrategyInputs inputs)
    {
        var loan = inputs.Mortgage;
        var mortgage = new MortgagePayments(loan, buydown: null);
        var balance = loan.Principal;
        var interest = 0m;
        for (var month = 1; month <= Math.Min(12, loan.TermInMonths) && balance > 0; month++)
        {
            var (thisMonth, principal, _) = mortgage.Pay(month, balance);
            interest += thisMonth;
            balance -= principal;
        }
        return interest;
    }

    /// <summary>
    /// The yearly return a taxable account keeps when the gains are taxed once, on selling after
    /// <paramref name="years"/> years: ((1 + r)ⁿ less the tax on the gain)^(1/n) − 1. Deferring the tax is
    /// worth a lot: 8% for 25 years at a 15% rate keeps about 7.4% a year, not 8% × 0.85 = 6.8%.
    /// </summary>
    /// <param name="annualReturn">The yearly return before tax, as a percentage.</param>
    /// <param name="capitalGainsTaxRate">The tax rate on the gain, as a percentage.</param>
    /// <param name="years">How long the money stays invested.</param>
    internal static decimal ReturnKeptAfterSaleTax(decimal annualReturn, decimal capitalGainsTaxRate, decimal years)
    {
        if (annualReturn <= 0 || capitalGainsTaxRate == 0)
            return annualReturn; // a loss is not taxed, and untaxed gains keep the whole return
        var n = (double)years;
        var growth = Math.Pow(1 + (double)annualReturn / 100, n);
        var kept = growth - (growth - 1) * (double)capitalGainsTaxRate / 100;
        return Percent((decimal)((Math.Pow(kept, 1 / n) - 1) * 100));
    }

    private static decimal Percent(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
