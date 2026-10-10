using System.Diagnostics.CodeAnalysis;

namespace MortgageAnalytics.Application.Contracts;

/// <summary>How the household files its federal return.</summary>
public enum TaxFilingStatus
{
    /// <summary>Single filer ($16,100 standard deduction in 2026).</summary>
    [SuppressMessage("Naming", "CA1720:Identifier contains type name", Justification = "The IRS name, and the JSON value clients send.")]
    Single = 0,

    /// <summary>Married filing jointly ($32,200).</summary>
    MarriedFilingJointly = 1,

    /// <summary>Head of household ($24,150).</summary>
    HeadOfHousehold = 2,
}

/// <summary>How much of the expected market return to count on.</summary>
public enum InvestorRiskProfile
{
    /// <summary>Count on 4 points less than the expected return.</summary>
    Conservative = 0,

    /// <summary>Count on 2 points less.</summary>
    Balanced = 1,

    /// <summary>Count on the full expected return.</summary>
    Aggressive = 2,
}

/// <summary>A way of putting extra cash to work.</summary>
public enum PayoffStrategy
{
    /// <summary>Every extra dollar to principal; once the mortgage is gone, everything is invested.</summary>
    PayOffFirst = 0,

    /// <summary>Pay only what is required and invest every extra dollar.</summary>
    InvestTheDifference = 1,

    /// <summary>A split set by the after-tax rates and the stock already arriving.</summary>
    Hybrid = 2,
}

/// <summary>The mortgage, household, investment options and market assumptions to compare strategies for.</summary>
public sealed record StrategyRequest
{
    /// <summary>What is still owed on the mortgage.</summary>
    /// <example>300000</example>
    public decimal CurrentBalance { get; init; }

    /// <summary>The mortgage's annual interest rate, as a percentage.</summary>
    /// <example>6.5</example>
    public decimal AnnualInterestRate { get; init; }

    /// <summary>How many monthly payments are left (at most 360).</summary>
    /// <example>300</example>
    public int RemainingTermInMonths { get; init; }

    /// <summary>When the next payment is due. Defaults to the first day of next month.</summary>
    /// <example>2026-11-01</example>
    public DateOnly? NextPaymentDate { get; init; }

    /// <summary>What the home is worth today.</summary>
    /// <example>400000</example>
    public decimal HomeValue { get; init; }

    /// <summary>How much the home's value changes a year, as a percentage.</summary>
    /// <example>4.3</example>
    public decimal HomeGrowthRate { get; init; }

    /// <summary>Pay before tax.</summary>
    /// <example>120000</example>
    public decimal GrossAnnualIncome { get; init; }

    /// <summary>Federal plus state tax on the next dollar earned, as a percentage.</summary>
    /// <example>24</example>
    public decimal MarginalTaxRate { get; init; }

    /// <summary>Tax on long-term gains in a taxable account, as a percentage.</summary>
    /// <example>15</example>
    public decimal CapitalGainsTaxRate { get; init; }

    /// <summary>How the household files, which sets the standard deduction.</summary>
    /// <example>MarriedFilingJointly</example>
    public TaxFilingStatus FilingStatus { get; init; }

    /// <summary>Itemized deductions other than mortgage interest, per year: state and local taxes (up to the cap), charity.</summary>
    /// <example>10000</example>
    public decimal OtherItemizedDeductions { get; init; }

    /// <summary>Take-home cash left each month after the mortgage payment and living costs.</summary>
    /// <example>1000</example>
    public decimal MonthlyCashToPutToWork { get; init; }

    /// <summary>How much the employer adds per dollar put into the 401(k), as a percentage.</summary>
    /// <example>50</example>
    public decimal EmployerMatchPercent { get; init; }

    /// <summary>The share of pay the match applies to, as a percentage.</summary>
    /// <example>6</example>
    public decimal MatchUpToPercentOfPay { get; init; }

    /// <summary>The share of pay put into an employee stock purchase plan, as a percentage. Zero for none.</summary>
    /// <example>0</example>
    public decimal EsppContributionPercent { get; init; }

    /// <summary>The ESPP's discount on the purchase price, as a percentage.</summary>
    /// <example>15</example>
    public decimal EsppDiscountPercent { get; init; }

    /// <summary>Months between ESPP purchases (shares are sold when bought).</summary>
    /// <example>6</example>
    public int EsppPurchasePeriodMonths { get; init; } = 6;

    /// <summary>How much invested cash goes into a Roth or traditional IRA each year (at most $7,500).</summary>
    /// <example>7500</example>
    public decimal AnnualIraContribution { get; init; }

    /// <summary>What vesting RSUs are worth each year, after the tax withheld at vest.</summary>
    /// <example>0</example>
    public decimal AnnualRsuVesting { get; init; }

    /// <summary>True to sell RSUs as they vest and use the cash; false to keep them as shares.</summary>
    /// <example>false</example>
    public bool SellRsusAtVest { get; init; }

    /// <summary>What the employer puts into an employee stock ownership plan (ESOP) each year.</summary>
    /// <example>0</example>
    public decimal AnnualEsopContribution { get; init; }

    /// <summary>What is in 401(k)s and traditional IRAs today.</summary>
    /// <example>50000</example>
    public decimal CurrentRetirementSavings { get; init; }

    /// <summary>Taxable investments today, vested RSUs included.</summary>
    /// <example>20000</example>
    public decimal CurrentInvestments { get; init; }

    /// <summary>The average yearly return of an S&amp;P 500 index fund, dividends included, as a percentage. An average, never a guarantee.</summary>
    /// <example>10</example>
    public decimal ExpectedAnnualReturn { get; init; }

    /// <summary>Yearly inflation, as a percentage.</summary>
    /// <example>3</example>
    public decimal InflationRate { get; init; }

    /// <summary>How much of the expected return to count on.</summary>
    /// <example>Balanced</example>
    public InvestorRiskProfile RiskProfile { get; init; } = InvestorRiskProfile.Balanced;
}

/// <summary>Every strategy side by side, and the one to recommend.</summary>
/// <param name="Recommended">The strategy worth the most after 30 years at the risk-adjusted return.</param>
/// <param name="RunnerUp">The next best at the risk-adjusted return.</param>
/// <param name="Lead">How much more the recommended strategy is worth after 30 years than the runner-up.</param>
/// <param name="LeadPercent">The lead as a percentage of the runner-up's net worth, or null when that is not positive.</param>
/// <param name="ExpectedWinner">The strategy worth the most at the expected return.</param>
/// <param name="BadDecadeWinner">The strategy worth the most when the first ten years are a lost decade.</param>
/// <param name="Plan">Where each month's cash goes before a strategy chooses.</param>
/// <param name="Rates">The rates behind the comparison.</param>
/// <param name="Strategies">Pay off first, invest the difference and the hybrid, in that order.</param>
public sealed record StrategyComparisonResponse(
    PayoffStrategy Recommended,
    PayoffStrategy RunnerUp,
    decimal Lead,
    decimal? LeadPercent,
    PayoffStrategy ExpectedWinner,
    PayoffStrategy BadDecadeWinner,
    MonthlyCashPlanResponse Plan,
    StrategyRatesResponse Rates,
    IReadOnlyList<StrategyOutcomeResponse> Strategies);

/// <summary>Where each month's cash goes before a strategy chooses: the required payment, then free money.</summary>
/// <param name="MortgagePayment">The required principal-and-interest payment.</param>
/// <param name="RetirementContribution">The pre-tax 401(k) contribution that earns the whole match.</param>
/// <param name="EmployerMatch">What the employer adds.</param>
/// <param name="RetirementContributionCost">What that contribution costs in take-home pay.</param>
/// <param name="EsppContribution">Take-home pay set aside for the ESPP.</param>
/// <param name="ExtraCash">What is left for the strategy to direct.</param>
public sealed record MonthlyCashPlanResponse(
    decimal MortgagePayment,
    decimal RetirementContribution,
    decimal EmployerMatch,
    decimal RetirementContributionCost,
    decimal EsppContribution,
    decimal ExtraCash);

/// <summary>The rates behind the comparison. Paying down the mortgage earns its rate for certain; the market's return is an average.</summary>
/// <param name="MortgageRate">The mortgage's rate.</param>
/// <param name="FirstYearInterest">Interest in the first year.</param>
/// <param name="FirstYearTaxSaved">Tax that interest saves in the first year; zero when the standard deduction is larger.</param>
/// <param name="StandardDeduction">The household's standard deduction.</param>
/// <param name="InterestIsDeducted">True when itemizing beats the standard deduction.</param>
/// <param name="AfterTaxMortgageRate">What paying down the mortgage is guaranteed to earn, after tax.</param>
/// <param name="ExpectedReturn">The expected market return.</param>
/// <param name="RiskMargin">Points taken off for the risk profile.</param>
/// <param name="RiskAdjustedReturn">The expected return minus the margin: what strategies are ranked on.</param>
/// <param name="IraShelteredPercent">The share of the extra cash that fits in the IRA, where it grows tax-free.</param>
/// <param name="TaxableAfterTaxReturn">The risk-adjusted return a taxable account keeps a year, with the gains taxed once, on selling.</param>
/// <param name="AfterTaxRiskAdjustedReturn">What invested extra cash keeps after tax: the IRA share untaxed, the rest taxed on selling.</param>
/// <param name="RateEdge">The after-tax market return minus the after-tax mortgage rate, in points.</param>
/// <param name="BadDecadeReturn">The yearly return during the bad decade.</param>
/// <param name="EmployerMatchPercent">The match: an instant return of this much on every matched dollar.</param>
/// <param name="EsppGainPercent">The ESPP's gain on each purchase, before tax.</param>
/// <param name="TargetInvestPercent">The share of all new savings the hybrid aims to put in the market.</param>
/// <param name="AutomaticAnnualStock">Stock that arrives each year whatever the strategy (RSUs kept, ESOP).</param>
/// <param name="DiscretionaryAnnualCash">The extra cash a strategy directs each year.</param>
/// <param name="HybridInvestPercent">The share of extra cash the hybrid invests.</param>
public sealed record StrategyRatesResponse(
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
    decimal RateEdge,
    decimal BadDecadeReturn,
    decimal EmployerMatchPercent,
    decimal EsppGainPercent,
    decimal TargetInvestPercent,
    decimal AutomaticAnnualStock,
    decimal DiscretionaryAnnualCash,
    decimal HybridInvestPercent);

/// <summary>One strategy in each market scenario.</summary>
/// <param name="Strategy">Which strategy.</param>
/// <param name="InvestPercent">The share of extra cash it invests while the mortgage is owed.</param>
/// <param name="Expected">At the expected return.</param>
/// <param name="RiskAdjusted">At the risk-adjusted return.</param>
/// <param name="BadDecade">With a lost decade first, then the risk-adjusted return.</param>
public sealed record StrategyOutcomeResponse(
    PayoffStrategy Strategy,
    decimal InvestPercent,
    StrategyProjectionResponse Expected,
    StrategyProjectionResponse RiskAdjusted,
    StrategyProjectionResponse BadDecade);

/// <summary>One strategy played out over 30 years.</summary>
/// <param name="TotalInterest">Mortgage interest paid.</param>
/// <param name="TotalTaxSaved">Tax saved by deducting it.</param>
/// <param name="PayoffMonth">The month the mortgage is paid off, or null when it is still owed after 30 years.</param>
/// <param name="PayoffDate">That payment's due date, or null.</param>
/// <param name="CrossoverMonth">The first month investments (after tax) cover the balance: 0 when they already do, null when never.</param>
/// <param name="CrossoverDate">That payment's due date, or null.</param>
/// <param name="Years">Year 0 (today) through year 30.</param>
public sealed record StrategyProjectionResponse(
    decimal TotalInterest,
    decimal TotalTaxSaved,
    int? PayoffMonth,
    DateOnly? PayoffDate,
    int? CrossoverMonth,
    DateOnly? CrossoverDate,
    IReadOnlyList<NetWorthYearResponse> Years);

/// <summary>Where a strategy stands at the end of a year.</summary>
/// <param name="Year">Years from today; 0 is today.</param>
/// <param name="HomeValue">What the home is worth.</param>
/// <param name="MortgageBalance">What is still owed.</param>
/// <param name="HomeEquity">Home value minus what is owed.</param>
/// <param name="Investments">Every account, after the tax still owed on it.</param>
/// <param name="NetWorth">Home equity plus investments.</param>
/// <param name="NetWorthInTodaysDollars">The same in today's dollars.</param>
public sealed record NetWorthYearResponse(
    int Year,
    decimal HomeValue,
    decimal MortgageBalance,
    decimal HomeEquity,
    decimal Investments,
    decimal NetWorth,
    decimal NetWorthInTodaysDollars);
