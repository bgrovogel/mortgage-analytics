using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Testing;

/// <summary>
/// Known-good strategy comparisons. Like <see cref="ReferenceLoans"/>, every value was computed by an
/// independent Python <c>Decimal</c> model written from the rules, never copied from this code. Year-30
/// figures compound 360 months of rounding, so agreement to the cent is a strong check.
/// </summary>
public static class ReferenceStrategies
{
    /// <summary>The next payment on every reference mortgage.</summary>
    public static readonly DateOnly NextPaymentDate = new(2026, 1, 1);

    /// <summary>
    /// A typical household: $300,000 left at 6.5% over 28 years (a 2024 loan) on a $400,000 home; $120,000 income, married filing
    /// jointly: the 12% federal bracket plus 5% state, so a 17% tax rate, and 20% on capital gains (15% plus the state's
    /// 5%); $14,000 of other deductions (state income tax, property tax and charity), so itemizing beats the standard
    /// deduction by a little; $1,000 a month to put to work; a 50% match on up to 6% of pay; $50,000 in a 401(k) and
    /// $20,000 invested; a $7,500 IRA each year; a 10% expected return, 3% inflation, and a balanced risk profile.
    /// </summary>
    public static StrategyInputs TypicalInputs(
        RiskProfile riskProfile = RiskProfile.Balanced,
        decimal annualRsuVesting = 0m,
        bool sellRsusAtVest = false,
        decimal annualEsopContribution = 0m,
        decimal monthlyCash = 1_000m,
        StockPurchasePlan? stockPurchasePlan = null,
        LoanTerms? mortgage = null,
        EmployerMatch? match = null,
        MarketAssumptions? market = null,
        decimal otherDeductions = 14_000m) =>
        new(
            mortgage ?? new LoanTerms(300_000m, 6.5m, 336, NextPaymentDate),
            homeValue: 400_000m,
            homeGrowthRate: 4.3m,
            new Household(120_000m, 17m, 20m, FilingStatus.MarriedFilingJointly, otherDeductions, monthlyCash,
                annualRsuVesting: annualRsuVesting, sellRsusAtVest: sellRsusAtVest, annualEsopContribution: annualEsopContribution,
                currentRetirementSavings: 50_000m, currentInvestments: 20_000m),
            match ?? new EmployerMatch(50m, 6m),
            stockPurchasePlan ?? StockPurchasePlan.None,
            annualIraContribution: 7_500m,
            market ?? new MarketAssumptions(10m, 3m, riskProfile));

    /// <summary><see cref="TypicalInputs"/> as an API request.</summary>
    public static StrategyRequest TypicalRequest => new()
    {
        CurrentBalance = 300_000m,
        AnnualInterestRate = 6.5m,
        RemainingTermInMonths = 336,
        NextPaymentDate = NextPaymentDate,
        HomeValue = 400_000m,
        HomeGrowthRate = 4.3m,
        GrossAnnualIncome = 120_000m,
        MarginalTaxRate = 17m,
        CapitalGainsTaxRate = 20m,
        FilingStatus = TaxFilingStatus.MarriedFilingJointly,
        OtherItemizedDeductions = 14_000m,
        MonthlyCashToPutToWork = 1_000m,
        EmployerMatchPercent = 50m,
        MatchUpToPercentOfPay = 6m,
        EsppDiscountPercent = 15m,
        EsppPurchasePeriodMonths = 6,
        AnnualIraContribution = 7_500m,
        CurrentRetirementSavings = 50_000m,
        CurrentInvestments = 20_000m,
        ExpectedAnnualReturn = 10m,
        InflationRate = 3m,
        RiskProfile = InvestorRiskProfile.Balanced,
    };

    /// <summary><see cref="TypicalInputs"/> worked out.</summary>
    public static class Typical
    {
        /// <summary>Principal and interest each month.</summary>
        public const decimal MortgagePayment = 1_941.05m;

        /// <summary>6% of pay, which earns the whole match.</summary>
        public const decimal RetirementContribution = 600m;

        /// <summary>Half of it.</summary>
        public const decimal EmployerMatch = 300m;

        /// <summary>What the pre-tax contribution costs in take-home pay at 17%.</summary>
        public const decimal RetirementContributionCost = 498m;

        /// <summary>What is left for a strategy to direct.</summary>
        public const decimal ExtraCash = 502m;

        /// <summary>Interest in the first year.</summary>
        public const decimal FirstYearInterest = 19_384.96m;

        /// <summary>The risk-adjusted return (10% − 2), untaxed: the $502 a month fits in the $7,500 IRA.</summary>
        public const decimal AfterTaxRiskAdjustedReturn = 8m;

        /// <summary>8% for 28 years in a taxable account, taxed 20% on selling: about 7.25% a year (not 8 × 0.8 = 6.4).</summary>
        public const decimal TaxableAfterTaxReturn = 7.25m;

        /// <summary>
        /// Itemizing beats the $32,200 standard deduction by only $1,185, so the $19,384.96 of interest saves just $201.44:
        /// paying down earns 6.5% less the 1% of the interest that gives back, 6.43%.
        /// </summary>
        public const decimal AfterTaxMortgageRate = 6.43m;

        /// <summary>The tax the first year's interest saves: (14,000 + 19,384.96 − 32,200) × 17%.</summary>
        public const decimal FirstYearTaxSaved = 201.44m;

        /// <summary>50 + 25 × (8 − 6.43) = 89.25, rounded.</summary>
        public const decimal HybridInvestPercent = 89m;

        /// <summary>Pay off first: paid off in month 203.</summary>
        public static class PayOffFirst
        {
            /// <summary>The month the mortgage is gone.</summary>
            public const int PayoffMonth = 203;

            /// <summary>Its due date.</summary>
            public static readonly DateOnly PayoffDate = new(2042, 11, 1);

            /// <summary>Interest paid.</summary>
            public const decimal TotalInterest = 194_485.77m;

            /// <summary>Owed after 10 years.</summary>
            public const decimal BalanceAtYear10 = 161_932.50m;

            /// <summary>Net worth after 5 years at the risk-adjusted return.</summary>
            public const decimal RiskAdjustedNetWorthAtYear5 = 394_732.50m;

            /// <summary>Net worth after 30 years at the risk-adjusted return.</summary>
            public const decimal RiskAdjustedNetWorthAtYear30 = 3_673_788.85m;

            /// <summary>The same in today's dollars (3% inflation).</summary>
            public const decimal RiskAdjustedNetWorthAtYear30InTodaysDollars = 1_513_552.36m;

            /// <summary>Net worth after 30 years with a bad decade first.</summary>
            public const decimal BadDecadeNetWorthAtYear30 = 3_108_085.81m;

            /// <summary>Net worth after 30 years at the expected return.</summary>
            public const decimal ExpectedNetWorthAtYear30 = 4_674_404.18m;

            /// <summary>The month investments (after tax) first cover the balance, at the risk-adjusted return.</summary>
            public const int RiskAdjustedCrossoverMonth = 93;

            /// <summary>Its due date.</summary>
            public static readonly DateOnly RiskAdjustedCrossoverDate = new(2033, 9, 1);
        }

        /// <summary>Invest the difference: the mortgage runs its full 28 years.</summary>
        public static class InvestTheDifference
        {
            /// <summary>The scheduled last payment.</summary>
            public const int PayoffMonth = 336;

            /// <summary>Interest paid.</summary>
            public const decimal TotalInterest = 352_191.25m;

            /// <summary>Net worth after 30 years at the risk-adjusted return: the highest.</summary>
            public const decimal RiskAdjustedNetWorthAtYear30 = 3_808_385.62m;

            /// <summary>Net worth after 30 years with a bad decade first: below paying off first.</summary>
            public const decimal BadDecadeNetWorthAtYear30 = 3_087_170.33m;

            /// <summary>Investments after 30 years at the risk-adjusted return, after tax.</summary>
            public const decimal RiskAdjustedInvestmentsAtYear30 = 2_393_930.27m;
        }

        /// <summary>The hybrid: 89% invested, 11% to principal.</summary>
        public static class Hybrid
        {
            /// <summary>The month the mortgage is gone.</summary>
            public const int PayoffMonth = 312;

            /// <summary>Net worth after 30 years at the risk-adjusted return.</summary>
            public const decimal RiskAdjustedNetWorthAtYear30 = 3_791_594.38m;
        }
    }

    /// <summary>
    /// <see cref="TypicalInputs"/> plus $50,000 of RSUs kept as shares and a $5,000 ESOP contribution each year:
    /// more stock than the hybrid's 89% target of all new savings, so it puts all extra cash on the mortgage.
    /// </summary>
    public static class StockHeavy
    {
        /// <summary>The hybrid's share invested: none.</summary>
        public const decimal HybridInvestPercent = 0m;

        /// <summary>Pay off first (and so the hybrid): net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal PayOffFirstRiskAdjustedNetWorthAtYear30 = 8_975_242.92m;

        /// <summary>Investments after 30 years, after tax, at the risk-adjusted return, paying off first.</summary>
        public const decimal PayOffFirstRiskAdjustedInvestmentsAtYear30 = 7_560_787.57m;
    }

    /// <summary>
    /// The typical household on a 7/1 ARM with 60 payments still fixed at 6.5%, expected to reset to 8.5% within
    /// 2/1/5 caps (8.5% at the first reset, held there). The rate it pays averages 8.10%, 8.02% after the little tax its
    /// interest saves: almost even with the market's risk-adjusted 8%, so the hybrid's even split ends highest.
    /// </summary>
    public static StrategyInputs ArmInputs()
    {
        var loan = new LoanTerms(300_000m, 6.5m, 300, NextPaymentDate);
        return TypicalInputs(mortgage: loan.WithAdjustableRate(new AdjustableRate(60, 12, 8.5m, 2m, 1m, 5m)));
    }

    /// <summary>Reference values for <see cref="ArmInputs"/>, from tools/strategy-check/strategy_model.py.</summary>
    public static class Arm
    {
        /// <summary>The rate paying down earns, on average over the payments left.</summary>
        public const decimal AverageMortgageRate = 8.10m;

        /// <summary>The hybrid's share invested.</summary>
        public const decimal HybridInvestPercent = 50m;

        /// <summary>First-year interest, all at the starting rate.</summary>
        public const decimal FirstYearInterest = 19_354.15m;

        /// <summary>Pay off first: net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal PayOffFirstRiskAdjustedNetWorthAtYear30 = 3_628_144.96m;

        /// <summary>Invest: net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal InvestRiskAdjustedNetWorthAtYear30 = 3_626_586.08m;

        /// <summary>Invest: total interest, the reset included.</summary>
        public const decimal InvestTotalInterest = 387_399.16m;

        /// <summary>Pay off first: when the mortgage is gone.</summary>
        public const int PayOffFirstPayoffMonth = 214;
    }

    /// <summary>
    /// The typical household on a new 30-year loan with a 2-1 buydown: the household pays as if at 4.5%, then 5.5%,
    /// and the subsidy frees that difference to put to work.
    /// </summary>
    public static StrategyInputs BuydownInputs() =>
        TypicalInputs(mortgage: new LoanTerms(300_000m, 6.5m, 360, NextPaymentDate)) with { Buydown = new TemporaryBuydown([2m, 1m]) };

    /// <summary>Reference values for <see cref="BuydownInputs"/>, from tools/strategy-check/strategy_model.py.</summary>
    public static class Buydown
    {
        /// <summary>What the subsidy pays over the two years.</summary>
        public const decimal Subsidy = 6_827.64m;

        /// <summary>Invest: net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal InvestRiskAdjustedNetWorthAtYear30 = 3_293_315.15m;

        /// <summary>Pay off first: net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal PayOffFirstRiskAdjustedNetWorthAtYear30 = 3_237_223.15m;

        /// <summary>Pay off first: when the mortgage is gone.</summary>
        public const int PayOffFirstPayoffMonth = 286;
    }

    /// <summary>
    /// A $700,000 loan at 7% over 30 years on a $900,000 home; a single filer earning $250,000: the 24% federal bracket
    /// plus 5% state, so 29%, and 23.8% on capital gains (15%, the 3.8% net investment income tax, and the state's 5%);
    /// $28,000 of other deductions (state and property taxes, charity) and $3,000 a month to put to work. Itemizing
    /// wins by more than the interest, so every dollar of it is deducted.
    /// </summary>
    public static StrategyInputs ItemizerInputs() =>
        new(
            new LoanTerms(700_000m, 7m, 360, NextPaymentDate),
            homeValue: 900_000m,
            homeGrowthRate: 4.3m,
            new Household(250_000m, 29m, 23.8m, FilingStatus.SingleFiler, 28_000m, 3_000m,
                currentRetirementSavings: 50_000m, currentInvestments: 20_000m),
            new EmployerMatch(50m, 6m),
            StockPurchasePlan.None,
            annualIraContribution: 7_500m,
            new MarketAssumptions(10m, 3m, RiskProfile.Balanced));

    /// <summary><see cref="ItemizerInputs"/> worked out.</summary>
    public static class Itemizer
    {
        /// <summary>Interest in the first year.</summary>
        public const decimal FirstYearInterest = 48_774.74m;

        /// <summary>All of the interest, at 29%: 28,000 + 48,774.74 is more than 48,774.74 above the 16,100 standard deduction.</summary>
        public const decimal FirstYearTaxSaved = 14_144.67m;

        /// <summary>7% × (1 − 29%).</summary>
        public const decimal AfterTaxMortgageRate = 4.97m;

        /// <summary>Tax saved over 30 years, investing the difference (the standard deduction rising 3% a year).</summary>
        public const decimal InvestTheDifferenceTotalTaxSaved = 283_202.53m;

        /// <summary>Tax saved over 30 years, paying off first: less interest, so less to deduct.</summary>
        public const decimal PayOffFirstTotalTaxSaved = 89_326.27m;
    }

    /// <summary><see cref="TypicalInputs"/> with $2,000 a month and 10% of pay in a 15%-discount ESPP that buys every 6 months.</summary>
    public static class WithEspp
    {
        /// <summary>The ESPP plan.</summary>
        public static StockPurchasePlan Plan => new(10m, 15m, 6);

        /// <summary>10% of $120,000 a month.</summary>
        public const decimal MonthlyContribution = 1_000m;

        /// <summary>Pay off first, with the ESPP gains going to principal: paid off in month 114.</summary>
        public const int PayOffFirstPayoffMonth = 114;

        /// <summary>Net worth after 30 years at the risk-adjusted return, paying off first.</summary>
        public const decimal PayOffFirstRiskAdjustedNetWorthAtYear30 = 5_008_147.66m;
    }
}
