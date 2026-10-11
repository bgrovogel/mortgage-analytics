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
    /// A typical household: $300,000 left at 6.5% over 25 years on a $400,000 home; $120,000 income, a 24% tax
    /// rate, married filing jointly with $10,000 of other deductions (so the standard deduction wins); $1,000 a
    /// month to put to work; a 50% match on up to 6% of pay; $50,000 in a 401(k) and $20,000 invested; a $7,500
    /// IRA each year; a 10% expected return, 3% inflation, and a balanced risk profile.
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
        MarketAssumptions? market = null) =>
        new(
            mortgage ?? new LoanTerms(300_000m, 6.5m, 300, NextPaymentDate),
            homeValue: 400_000m,
            homeGrowthRate: 4.3m,
            new Household(120_000m, 24m, 15m, FilingStatus.MarriedFilingJointly, 10_000m, monthlyCash,
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
        RemainingTermInMonths = 300,
        NextPaymentDate = NextPaymentDate,
        HomeValue = 400_000m,
        HomeGrowthRate = 4.3m,
        GrossAnnualIncome = 120_000m,
        MarginalTaxRate = 24m,
        CapitalGainsTaxRate = 15m,
        FilingStatus = TaxFilingStatus.MarriedFilingJointly,
        OtherItemizedDeductions = 10_000m,
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
        public const decimal MortgagePayment = 2_025.62m;

        /// <summary>6% of pay, which earns the whole match.</summary>
        public const decimal RetirementContribution = 600m;

        /// <summary>Half of it.</summary>
        public const decimal EmployerMatch = 300m;

        /// <summary>What the pre-tax contribution costs in take-home pay at 24%.</summary>
        public const decimal RetirementContributionCost = 456m;

        /// <summary>What is left for a strategy to direct.</summary>
        public const decimal ExtraCash = 544m;

        /// <summary>Interest in the first year.</summary>
        public const decimal FirstYearInterest = 19_354.15m;

        /// <summary>The risk-adjusted return (10% − 2), untaxed: the $544 a month fits in the $7,500 IRA.</summary>
        public const decimal AfterTaxRiskAdjustedReturn = 8m;

        /// <summary>8% for 25 years in a taxable account, taxed 15% on selling: about 7.41% a year (not 8 × 0.85 = 6.8).</summary>
        public const decimal TaxableAfterTaxReturn = 7.41m;

        /// <summary>50 + 25 × (8 − 6.5) = 87.5, rounded.</summary>
        public const decimal HybridInvestPercent = 88m;

        /// <summary>Pay off first: paid off in month 186.</summary>
        public static class PayOffFirst
        {
            /// <summary>The month the mortgage is gone.</summary>
            public const int PayoffMonth = 186;

            /// <summary>Its due date.</summary>
            public static readonly DateOnly PayoffDate = new(2041, 6, 1);

            /// <summary>Interest paid.</summary>
            public const decimal TotalInterest = 176_023.74m;

            /// <summary>Owed after 10 years.</summary>
            public const decimal BalanceAtYear10 = 140_922.96m;

            /// <summary>Net worth after 5 years at the risk-adjusted return.</summary>
            public const decimal RiskAdjustedNetWorthAtYear5 = 394_188.07m;

            /// <summary>Net worth after 30 years at the risk-adjusted return.</summary>
            public const decimal RiskAdjustedNetWorthAtYear30 = 3_719_026.59m;

            /// <summary>The same in today's dollars (3% inflation).</summary>
            public const decimal RiskAdjustedNetWorthAtYear30InTodaysDollars = 1_532_189.71m;

            /// <summary>Net worth after 30 years with a bad decade first.</summary>
            public const decimal BadDecadeNetWorthAtYear30 = 3_187_295.65m;

            /// <summary>Net worth after 30 years at the expected return.</summary>
            public const decimal ExpectedNetWorthAtYear30 = 4_700_702.70m;

            /// <summary>The month investments (after tax) first cover the balance, at the risk-adjusted return.</summary>
            public const int RiskAdjustedCrossoverMonth = 93;

            /// <summary>Its due date.</summary>
            public static readonly DateOnly RiskAdjustedCrossoverDate = new(2033, 9, 1);
        }

        /// <summary>Invest the difference: the mortgage runs its full 25 years.</summary>
        public static class InvestTheDifference
        {
            /// <summary>The scheduled last payment.</summary>
            public const int PayoffMonth = 300;

            /// <summary>Interest paid.</summary>
            public const decimal TotalInterest = 307_687.31m;

            /// <summary>Net worth after 30 years at the risk-adjusted return: the highest.</summary>
            public const decimal RiskAdjustedNetWorthAtYear30 = 3_844_781.09m;

            /// <summary>Net worth after 30 years with a bad decade first: below paying off first.</summary>
            public const decimal BadDecadeNetWorthAtYear30 = 3_145_932.42m;

            /// <summary>Investments after 30 years at the risk-adjusted return, after tax.</summary>
            public const decimal RiskAdjustedInvestmentsAtYear30 = 2_430_325.74m;
        }

        /// <summary>The hybrid: 88% invested, 12% to principal.</summary>
        public static class Hybrid
        {
            /// <summary>The month the mortgage is gone.</summary>
            public const int PayoffMonth = 278;

            /// <summary>Net worth after 30 years at the risk-adjusted return.</summary>
            public const decimal RiskAdjustedNetWorthAtYear30 = 3_826_630.91m;
        }
    }

    /// <summary>
    /// <see cref="TypicalInputs"/> plus $50,000 of RSUs kept as shares and a $5,000 ESOP contribution each year:
    /// more stock than the hybrid's 88% target of all new savings, so it puts all extra cash on the mortgage.
    /// </summary>
    public static class StockHeavy
    {
        /// <summary>The hybrid's share invested: none.</summary>
        public const decimal HybridInvestPercent = 0m;

        /// <summary>Pay off first (and so the hybrid): net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal PayOffFirstRiskAdjustedNetWorthAtYear30 = 9_189_039.47m;

        /// <summary>Investments after 30 years, after tax, at the risk-adjusted return, paying off first.</summary>
        public const decimal PayOffFirstRiskAdjustedInvestmentsAtYear30 = 7_774_584.12m;
    }

    /// <summary>
    /// The typical household on a 7/1 ARM with 60 payments still fixed at 6.5%, expected to reset to 8.5% within
    /// 2/1/5 caps (8.5% at the first reset, held there). The rate it pays averages 8.10%, so paying down wins.
    /// </summary>
    public static StrategyInputs ArmInputs()
    {
        var loan = new LoanTerms(300_000m, 6.5m, 300, NextPaymentDate);
        return TypicalInputs(mortgage: loan.WithRateChanges(new AdjustableRate(60, 12, 8.5m, 2m, 1m, 5m).RatePath(6.5m, 300)));
    }

    /// <summary>Reference values for <see cref="ArmInputs"/>, from tools/strategy-check/strategy_model.py.</summary>
    public static class Arm
    {
        /// <summary>The rate paying down earns, on average over the payments left.</summary>
        public const decimal AverageMortgageRate = 8.10m;

        /// <summary>The hybrid's share invested.</summary>
        public const decimal HybridInvestPercent = 48m;

        /// <summary>First-year interest, all at the starting rate.</summary>
        public const decimal FirstYearInterest = 19_354.15m;

        /// <summary>Pay off first: net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal PayOffFirstRiskAdjustedNetWorthAtYear30 = 3_577_419.84m;

        /// <summary>Invest: net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal InvestRiskAdjustedNetWorthAtYear30 = 3_567_099.07m;

        /// <summary>Invest: total interest, the reset included.</summary>
        public const decimal InvestTotalInterest = 387_399.16m;

        /// <summary>Pay off first: when the mortgage is gone.</summary>
        public const int PayOffFirstPayoffMonth = 206;
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
        public const decimal InvestRiskAdjustedNetWorthAtYear30 = 3_235_044.66m;

        /// <summary>Pay off first: net worth after 30 years at the risk-adjusted return.</summary>
        public const decimal PayOffFirstRiskAdjustedNetWorthAtYear30 = 3_170_861.22m;

        /// <summary>Pay off first: when the mortgage is gone.</summary>
        public const int PayOffFirstPayoffMonth = 273;
    }

    /// <summary>
    /// A $700,000 loan at 7% over 30 years on a $900,000 home; a single filer earning $250,000 at a 35% rate with
    /// $15,000 of other deductions and $3,000 a month to put to work. Itemizing wins, so the interest is deducted.
    /// </summary>
    public static StrategyInputs ItemizerInputs() =>
        new(
            new LoanTerms(700_000m, 7m, 360, NextPaymentDate),
            homeValue: 900_000m,
            homeGrowthRate: 4.3m,
            new Household(250_000m, 35m, 15m, FilingStatus.SingleFiler, 15_000m, 3_000m,
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

        /// <summary>(15,000 + 48,774.74 − 16,100) × 35%.</summary>
        public const decimal FirstYearTaxSaved = 16_686.16m;

        /// <summary>7% × (1 − 35%).</summary>
        public const decimal AfterTaxMortgageRate = 4.55m;

        /// <summary>Tax saved over 30 years, investing the difference (the standard deduction rising 3% a year).</summary>
        public const decimal InvestTheDifferenceTotalTaxSaved = 323_665.07m;

        /// <summary>Tax saved over 30 years, paying off first: less interest, so less to deduct.</summary>
        public const decimal PayOffFirstTotalTaxSaved = 98_256.31m;
    }

    /// <summary><see cref="TypicalInputs"/> with $2,000 a month and 10% of pay in a 15%-discount ESPP that buys every 6 months.</summary>
    public static class WithEspp
    {
        /// <summary>The ESPP plan.</summary>
        public static StockPurchasePlan Plan => new(10m, 15m, 6);

        /// <summary>10% of $120,000 a month.</summary>
        public const decimal MonthlyContribution = 1_000m;

        /// <summary>Pay off first, with the ESPP gains going to principal: paid off in month 108.</summary>
        public const int PayOffFirstPayoffMonth = 108;

        /// <summary>Net worth after 30 years at the risk-adjusted return, paying off first.</summary>
        public const decimal PayOffFirstRiskAdjustedNetWorthAtYear30 = 5_084_252.95m;
    }
}
