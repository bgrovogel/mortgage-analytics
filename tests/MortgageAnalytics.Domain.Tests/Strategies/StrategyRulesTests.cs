using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Strategies;
using static MortgageAnalytics.Testing.ReferenceStrategies;

namespace MortgageAnalytics.Domain.Tests.Strategies;

/// <summary>The rules the optimizer is built from, one at a time.</summary>
[TestFixture]
public class StrategyRulesTests
{
    private static Household Household(
        FilingStatus status = FilingStatus.MarriedFilingJointly,
        decimal otherDeductions = 0m,
        decimal taxRate = 24m,
        decimal monthlyCash = 1_000m,
        decimal income = 120_000m) =>
        new(income, taxRate, 15m, status, otherDeductions, monthlyCash);

    // ---- Deductions: only the part above the standard deduction saves tax ----

    [TestCase(FilingStatus.SingleFiler, 16_100)]
    [TestCase(FilingStatus.MarriedFilingJointly, 32_200)]
    [TestCase(FilingStatus.HeadOfHousehold, 24_150)]
    public void TheStandardDeduction_IsThe2026Amount(FilingStatus status, decimal expected) =>
        Assert.That(TaxDeductions.StandardDeduction(status), Is.EqualTo(expected), "IRS Rev. Proc. 2025-32");

    [TestCase(20_000, 10_000, 0, TestName = "Below the standard deduction: interest saves nothing")]
    [TestCase(30_000, 10_000, 1_872, TestName = "Partly above: only the excess saves tax")]
    [TestCase(40_000, 40_000, 9_600, TestName = "Other deductions already above it: all the interest saves tax")]
    public void InterestSavesTax_OnlyAboveTheStandardDeduction(decimal interest, decimal otherDeductions, decimal expected) =>
        Assert.That(TaxDeductions.TaxSavedByInterest(Household(otherDeductions: otherDeductions), interest), Is.EqualTo(expected),
            "a $32,200 joint standard deduction, taxed at 24%: deductions are not dollar-for-dollar savings");

    [Test]
    public void InterestOnMoreThan750k_IsOnlyPartlyDeductible()
    {
        Assert.Multiple(() =>
        {
            Assert.That(TaxDeductions.DeductibleInterest(50_000m, 600_000m), Is.EqualTo(50_000m), "under the limit: all of it");
            Assert.That(TaxDeductions.DeductibleInterest(70_000m, 1_000_000m), Is.EqualTo(52_500m), "a $1M loan: 75% of the interest");
        });
    }

    // ---- The monthly cash plan: free money first ----

    [Test]
    public void TheMatch_IsCapturedFirst_AtItsAfterTaxCost()
    {
        var plan = MonthlyCashPlan.For(TypicalInputs());

        Assert.Multiple(() =>
        {
            Assert.That(plan.MortgagePayment, Is.EqualTo(Typical.MortgagePayment), "the required payment");
            Assert.That(plan.RetirementContribution, Is.EqualTo(Typical.RetirementContribution), "6% of $120,000 a year, monthly");
            Assert.That(plan.EmployerMatch, Is.EqualTo(Typical.EmployerMatch), "half of it, from the employer");
            Assert.That(plan.RetirementContributionCost, Is.EqualTo(Typical.RetirementContributionCost), "pre-tax: $600 costs $456 of take-home pay");
            Assert.That(plan.ExtraCash, Is.EqualTo(Typical.ExtraCash), "what is left for the strategy");
        });
    }

    [Test]
    public void FreeMoney_NeverTakesMoreThanTheCashAvailable()
    {
        var plan = MonthlyCashPlan.For(TypicalInputs(monthlyCash: 249m, stockPurchasePlan: WithEspp.Plan));

        Assert.Multiple(() =>
        {
            Assert.That(plan.RetirementContribution, Is.EqualTo(300m), "$249 of take-home pay covers a $300 pre-tax contribution at 17%");
            Assert.That(plan.RetirementContributionCost, Is.EqualTo(249m), "all of it");
            Assert.That(plan.EsppContribution, Is.Zero, "nothing left for the ESPP");
            Assert.That(plan.ExtraCash, Is.Zero, "or anything else");
        });
    }

    [Test]
    public void TheEspp_IsLimitedTo25kOfStockAYear()
    {
        var plan = MonthlyCashPlan.For(TypicalInputs(monthlyCash: 5_000m, stockPurchasePlan: new StockPurchasePlan(25m, 15m, 6)));

        Assert.That(plan.EsppContribution, Is.EqualTo(1_770.83m), "$25,000 of stock at a 15% discount costs $21,250 a year, not 25% of $120,000");
    }

    [Test]
    public void WithoutAMatch_Nothing_GoesToThe401k()
    {
        var plan = MonthlyCashPlan.For(TypicalInputs(match: EmployerMatch.None));

        Assert.Multiple(() =>
        {
            Assert.That(plan.RetirementContribution, Is.Zero, "only the match is free money");
            Assert.That(plan.ExtraCash, Is.EqualTo(1_000m), "so all the cash is the strategy's");
        });
    }

    [Test]
    public void AnEsppDiscount_IsAGainOfDiscountOverOneMinusDiscount()
    {
        var plan = new StockPurchasePlan(10m, 15m, 6);

        Assert.Multiple(() =>
        {
            Assert.That(plan.GainPercent, Is.EqualTo(17.65m), "$85 buys $100 of stock");
            Assert.That(plan.SaleProceeds(850m), Is.EqualTo(1_000m), "and sells for it");
        });
    }

    // ---- The market ----

    [Test]
    public void MonthlyGrowth_CompoundsToTheYearlyReturn()
    {
        var factor = MarketScenario.MonthlyGrowthFactor(10m);
        var year = Enumerable.Repeat(factor, 12).Aggregate(1m, (total, f) => total * f);

        Assert.Multiple(() =>
        {
            Assert.That(factor, Is.EqualTo(1.0079741404m), "the twelfth root of 1.10, not 1 + 10% ÷ 12");
            Assert.That(year, Is.EqualTo(1.10m).Within(0.000_000_01m), "twelve months make 10%");
        });
    }

    [Test]
    public void ABadDecade_LosesAPercentAYear_ThenReturnsToNormal()
    {
        var scenario = MarketScenario.BadDecadeThen(8m);

        Assert.Multiple(() =>
        {
            Assert.That(scenario.AnnualReturnInYear(1), Is.EqualTo(-1m), "like 2000–2009");
            Assert.That(scenario.AnnualReturnInYear(10), Is.EqualTo(-1m), "for ten years");
            Assert.That(scenario.AnnualReturnInYear(11), Is.EqualTo(8m), "then the risk-adjusted return");
            Assert.That(MarketScenario.Steady(MarketScenarioKind.Expected, 10m).AnnualReturnInYear(1), Is.EqualTo(10m), "a steady scenario never dips");
        });
    }

    [TestCase(RiskProfile.Conservative, 6)]
    [TestCase(RiskProfile.Balanced, 8)]
    [TestCase(RiskProfile.Aggressive, 10)]
    public void TheRiskProfile_SetsHowMuchOfTheExpectedReturnIsCountedOn(RiskProfile profile, decimal expected) =>
        Assert.That(new MarketAssumptions(10m, 3m, profile).RiskAdjustedReturn, Is.EqualTo(expected), "market returns are never guaranteed, so a margin comes off");

    // ---- The hybrid's split ----

    [TestCase(RiskProfile.Aggressive, 100, TestName = "Aggressive: 10% tax-free in the IRA beats 6.43% by 3.57 points, all invested")]
    [TestCase(RiskProfile.Balanced, 89, TestName = "Balanced: 8% against 6.43%, mostly invested")]
    [TestCase(RiskProfile.Conservative, 39, TestName = "Conservative: 6% against 6.43%, mostly to the mortgage")]
    public void TheHybrid_LeansTowardWhicheverEarnsMore(RiskProfile profile, decimal expectedInvestPercent)
    {
        var inputs = TypicalInputs(riskProfile: profile);

        Assert.That(StrategyRates.For(inputs, MonthlyCashPlan.For(inputs)).HybridInvestPercent, Is.EqualTo(expectedInvestPercent),
            "equal rates split 50/50; each point of edge moves 25 points");
    }

    [Test]
    public void SomeStockArrivingAnyway_TrimsTheHybridsInvestedShare()
    {
        var inputs = TypicalInputs(annualEsopContribution: 2_000m);
        var rates = StrategyRates.For(inputs, MonthlyCashPlan.For(inputs));

        // Target 89% of $8,024 of new savings is $7,141; the ESOP brings $2,000, so $5,141 of the $6,024 extra.
        Assert.That(rates.HybridInvestPercent, Is.EqualTo(85m), "the ESOP counts toward the market's share");
    }

    [Test]
    public void WithNoExtraCash_TheHybridKeepsItsTarget()
    {
        var inputs = TypicalInputs(monthlyCash: 0m);
        var rates = StrategyRates.For(inputs, MonthlyCashPlan.For(inputs));

        Assert.Multiple(() =>
        {
            Assert.That(rates.DiscretionaryAnnualCash, Is.Zero, "nothing to split");
            Assert.That(rates.HybridInvestPercent, Is.EqualTo(rates.TargetInvestPercent), "so the split is just the target");
        });
    }

    [Test]
    public void ExtraCashThatFitsInTheIra_EarnsTheFullReturn_AndTheRestIsTaxedOnlyWhenSold()
    {
        var fits = StrategyRates.For(TypicalInputs(), MonthlyCashPlan.For(TypicalInputs()));
        var bigger = TypicalInputs(monthlyCash: 3_000m);
        var overflows = StrategyRates.For(bigger, MonthlyCashPlan.For(bigger));

        Assert.Multiple(() =>
        {
            Assert.That(fits.IraShelteredPercent, Is.EqualTo(100m), "$6,024 a year fits in the $7,500 IRA");
            Assert.That(fits.AfterTaxRiskAdjustedReturn, Is.EqualTo(8m), "so it keeps the whole 8%");
            Assert.That(fits.TaxableAfterTaxReturn, Is.EqualTo(Typical.TaxableAfterTaxReturn), "a taxable account would keep 7.25%: tax is paid once, on selling");
            Assert.That(overflows.IraShelteredPercent, Is.EqualTo(25m), "$7,500 of $30,024 a year fits in the IRA (24.98%)");
            // 25% at 8% and 75% at 7.25% = 7.4375, rounded.
            Assert.That(overflows.AfterTaxRiskAdjustedReturn, Is.EqualTo(7.44m), "a blend of the two");
        });
    }

    [TestCase(8, 15, 25, 7.41, TestName = "8% for 25 years, 15% on the gain at the end")]
    [TestCase(8, 15, 1, 6.8, TestName = "Sold after a year: the full 15% of the year's gain")]
    [TestCase(8, 0, 25, 8, TestName = "No capital gains tax: the whole return")]
    [TestCase(-1, 15, 25, -1, TestName = "A loss is not taxed")]
    public void TaxedOnlyWhenSold_ATaxableAccountKeepsMoreTheLongerItIsHeld(decimal annualReturn, decimal rate, decimal years, decimal expected) =>
        Assert.That(StrategyRates.ReturnKeptAfterSaleTax(annualReturn, rate, years), Is.EqualTo(expected), "((1 + r)ⁿ less the tax on the gain)^(1/n) − 1");

    [Test]
    public void TheStandardDeduction_RisesWithPrices_SoTheSameInterestSavesLessLater()
    {
        var household = Household(otherDeductions: 10_000m);

        Assert.Multiple(() =>
        {
            Assert.That(TaxDeductions.TaxSavedByInterest(household, 30_000m), Is.EqualTo(1_872m), "today: $7,800 above the $32,200 standard deduction, at 24%");
            // Ten years of 3%: the standard deduction is $43,274.11 and the other deductions $13,439.16.
            Assert.That(TaxDeductions.TaxSavedByInterest(household, 30_000m, 1.343916379m), Is.EqualTo(39.61m), "later: only $165.05 above it, at 24%");
        });
    }

    [Test]
    public void PayingDownEarnsTheRate_LessOnlyTheTaxItsInterestActuallySaves()
    {
        var barely = StrategyRates.For(TypicalInputs(), MonthlyCashPlan.For(TypicalInputs()));
        var fully = StrategyRates.For(ItemizerInputs(), MonthlyCashPlan.For(ItemizerInputs()));

        Assert.Multiple(() =>
        {
            Assert.That(barely.FirstYearTaxSaved, Is.EqualTo(Typical.FirstYearTaxSaved), "itemizing beats the standard deduction by only $1,185");
            Assert.That(barely.AfterTaxMortgageRate, Is.EqualTo(Typical.AfterTaxMortgageRate),
                "so 1% of the interest comes back, not 17% of it: 6.43%, not 6.5% × 83% = 5.40%");
            Assert.That(fully.AfterTaxMortgageRate, Is.EqualTo(Itemizer.AfterTaxMortgageRate), "every dollar deducted: 7% × (1 − 29%)");
        });
    }

    [Test]
    public void DeductionsExactlyAtTheStandardDeduction_AreNotItemized()
    {
        // $12,815.04 + $19,384.96 of interest is exactly the $32,200 joint standard deduction: nothing to gain by itemizing.
        var inputs = TypicalInputs(otherDeductions: 12_815.04m);
        var rates = StrategyRates.For(inputs, MonthlyCashPlan.For(inputs));

        Assert.Multiple(() =>
        {
            Assert.That(rates.InterestIsDeducted, Is.False, "itemizing must beat the standard deduction, not tie it");
            Assert.That(rates.AfterTaxMortgageRate, Is.EqualTo(6.5m), "so paying down earns the full rate");
        });
    }

    [Test]
    public void AZeroRateLoan_EarnsNothingToPayDown_AndSavesNoTax()
    {
        var inputs = TypicalInputs(mortgage: new LoanTerms(300_000m, 0m, 300, NextPaymentDate));
        var rates = StrategyRates.For(inputs, MonthlyCashPlan.For(inputs));

        Assert.That(rates.AfterTaxMortgageRate, Is.Zero, "no interest, so nothing for the deduction to give back");
    }

    [Test]
    public void ANegativeRiskAdjustedReturn_IsNotReducedByTax()
    {
        var inputs = TypicalInputs(market: new MarketAssumptions(1m, 3m, RiskProfile.Balanced));
        var rates = StrategyRates.For(inputs, MonthlyCashPlan.For(inputs));

        Assert.Multiple(() =>
        {
            Assert.That(rates.AfterTaxRiskAdjustedReturn, Is.EqualTo(-1m), "losses are not taxed");
            Assert.That(rates.HybridInvestPercent, Is.Zero, "and the mortgage wins outright");
        });
    }

    // ---- The simulator ----

    [Test]
    public void InvestmentsAlreadyCoveringTheMortgage_CrossOverToday()
    {
        var inputs = TypicalInputs(mortgage: new LoanTerms(10_000m, 6.5m, 300, NextPaymentDate));

        var projection = new StrategySimulator().Simulate(inputs, 100m, MarketScenario.Steady(MarketScenarioKind.Expected, 10m));

        Assert.Multiple(() =>
        {
            Assert.That(projection.CrossoverMonth, Is.Zero, "$50,000 + $20,000 already covers a $10,000 balance");
            Assert.That(projection.CrossoverDate, Is.Null, "so there is no date to wait for");
        });
    }

    [Test]
    public void AMortgageLongerThanTheHorizon_IsStillOwedAtTheEnd()
    {
        var inputs = TypicalInputs(monthlyCash: 0m, mortgage: new LoanTerms(300_000m, 6.5m, 480, NextPaymentDate));

        var projection = new StrategySimulator().Simulate(inputs, 100m, MarketScenario.Steady(MarketScenarioKind.Expected, 10m));

        Assert.Multiple(() =>
        {
            Assert.That(projection.PayoffMonth, Is.Null, "a 40-year loan outlasts the 30-year horizon");
            Assert.That(projection.PayoffDate, Is.Null, "so there is no payoff date");
            Assert.That(projection.Years[30].MortgageBalance, Is.GreaterThan(0m), "and a balance remains");
        });
    }

    [Test]
    public void TodaysDollars_ShrinkByInflation()
    {
        var projection = new StrategySimulator().Simulate(TypicalInputs(), 0m, MarketScenario.Steady(MarketScenarioKind.Expected, 10m));
        var year1 = projection.Years[1];

        Assert.Multiple(() =>
        {
            Assert.That(projection.Years[0].NetWorthInTodaysDollars, Is.EqualTo(projection.Years[0].NetWorth), "today is today");
            Assert.That(year1.NetWorthInTodaysDollars, Is.EqualTo(Money.Round(year1.NetWorth / 1.03m)), "a year out, 3% less");
            Assert.That(year1.HomeEquity, Is.EqualTo(year1.HomeValue - year1.MortgageBalance), "home equity is value minus what is owed");
        });
    }

    [Test]
    public void Retirement401kMoney_IsCountedAfterTheTaxOwedOnIt()
    {
        var accounts = new InvestmentAccounts(retirement: 100_000m, taxable: 50_000m);
        accounts.AddRoth(10_000m);
        accounts.Grow(1.2m);

        // 120,000 × 76% + 12,000 Roth + 60,000 taxable − 15% of the 10,000 gain.
        Assert.That(accounts.AfterTaxValue(Household()), Is.EqualTo(91_200m + 12_000m + 60_000m - 1_500m), "pre-tax money is not all yours");
    }

    // ---- Guards ----

    private static StrategyInputs WithHome(decimal homeValue, decimal growth, decimal ira)
    {
        var typical = TypicalInputs();
        return new StrategyInputs(typical.Mortgage, homeValue, growth, typical.Household, typical.Match, typical.StockPurchasePlan, ira, typical.Market);
    }

    private static StrategyProjection ProjectionIn(MarketScenarioKind kind) =>
        new StrategyOptimizer(new StrategySimulator()).Compare(TypicalInputs()).Outcomes[0].In(kind);

    [Test]
    public void OutOfRangeInputs_AreRejected()
    {
        Assert.Multiple(() =>
        {
            DomainAssert.Rejects(() => Household(taxRate: 61m), "Marginal tax rate", "tax rates stop at 60%");
            DomainAssert.Rejects(() => Household(monthlyCash: -1m), "Monthly cash", "no negative cash");
            DomainAssert.Rejects(() => new Household(1m, 24m, 15m, (FilingStatus)9, 0m, 0m), "filing status", "a real filing status");
            DomainAssert.Rejects(() => new EmployerMatch(201m, 6m), "employer match", "a match is at most 200%");
            DomainAssert.Rejects(() => new EmployerMatch(50m, 101m), "share of pay", "at most all of pay");
            DomainAssert.Rejects(() => new StockPurchasePlan(26m, 15m, 6), "ESPP contributions", "at most 25% of pay");
            DomainAssert.Rejects(() => new StockPurchasePlan(10m, 16m, 6), "discount", "§423 caps the discount at 15%");
            DomainAssert.Rejects(() => new StockPurchasePlan(10m, 15m, 28), "purchase period", "§423 caps offerings at 27 months");
            DomainAssert.Rejects(() => new MarketAssumptions(31m, 3m, RiskProfile.Balanced), "expected market return", "returns are capped");
            DomainAssert.Rejects(() => new MarketAssumptions(10m, 21m, RiskProfile.Balanced), "Inflation", "inflation is capped");
            DomainAssert.Rejects(() => new MarketAssumptions(10m, 3m, (RiskProfile)9), "risk profile", "a real profile");
            DomainAssert.Rejects(() => RiskProfiles.MarginInPoints((RiskProfile)9), "risk profile", "only the three profiles have a margin");
            DomainAssert.Rejects(() => MarketScenario.BadDecadeThen(51m), "market return", "scenario returns are capped");
            DomainAssert.Rejects(() => TaxDeductions.StandardDeduction((FilingStatus)9), "filing status", "only real statuses have a deduction");
            DomainAssert.Rejects(() => new StrategySimulator().Simulate(TypicalInputs(), 101m, MarketScenario.Steady(MarketScenarioKind.Expected, 10m)), "share of extra cash", "at most all of it is invested");
            DomainAssert.Rejects(() => WithHome(-1m, 4m, 0m), "Home value", "a home cannot be worth less than nothing");
            DomainAssert.Rejects(() => WithHome(1m, 26m, 0m), "Home value growth", "growth is capped");
            DomainAssert.Rejects(() => WithHome(1m, 4m, 7_501m), "IRA", "the 2026 IRA limit is $7,500");
            DomainAssert.Rejects(() => ProjectionIn((MarketScenarioKind)9), "market scenario", "only the three scenarios exist");
        });
    }

    // ---- What exists, and the edge between the rates ----

    [Test]
    public void RateEdge_IsHowFarTheAfterTaxMarketBeatsTheAfterTaxMortgage() =>
        Assert.That(StrategyRates.For(TypicalInputs(), MonthlyCashPlan.For(TypicalInputs())).RateEdge, Is.EqualTo(1.57m),
            "8% risk-adjusted (untaxed in the IRA) against 6.43% (the deduction gives back only 1% of the interest)");

    [Test]
    public void EsppMoney_CountsAsCashToInvest_WhenSizingTheIrasShare()
    {
        // A 10% ESPP takes the $544 left after the 401(k), leaving no other extra cash: its shares, sold, are the
        // $6,528 a year to invest, and that fits in the $7,500 IRA.
        var inputs = TypicalInputs(stockPurchasePlan: new StockPurchasePlan(10m, 15m, 6));

        Assert.That(StrategyRates.For(inputs, MonthlyCashPlan.For(inputs)).IraShelteredPercent, Is.EqualTo(100m),
            "ESPP money is invested like any other extra cash");
    }

    [TestCase(50, 6, true, TestName = "A 50% match on 6% of pay exists")]
    [TestCase(0, 6, false, TestName = "No match percent: no match")]
    [TestCase(50, 0, false, TestName = "No share of pay matched: no match")]
    public void AnEmployerMatch_ExistsOnlyWithBothAPercentAndAShareOfPay(decimal matchPercent, decimal upToPercentOfPay, bool exists) =>
        Assert.That(new EmployerMatch(matchPercent, upToPercentOfPay).Exists, Is.EqualTo(exists),
            "a match needs something to match and some pay to match it on");

    [Test]
    public void NoStockPurchasePlan_DoesNotExist() =>
        Assert.That(StockPurchasePlan.None.Exists, Is.False, "a plan nobody contributes to buys nothing");

    [Test]
    public void LeadPercent_IsLeftOut_WhenTheRunnerUpEndsWithNothing()
    {
        // No cash to put to work, no savings, no home value, and a 50-year loan still owed at year 30: every strategy
        // ends below zero, where a percentage lead means nothing.
        var household = new Household(120_000m, 24m, 15m, FilingStatus.SingleFiler, otherItemizedDeductions: 0m, monthlyCashToPutToWork: 0m);
        var inputs = new StrategyInputs(new LoanTerms(300_000m, 6.5m, 600, NextPaymentDate), homeValue: 0m, homeGrowthRate: 0m, household,
            EmployerMatch.None, StockPurchasePlan.None, annualIraContribution: 0m, new MarketAssumptions(10m, 3m, RiskProfile.Balanced));

        var comparison = new StrategyOptimizer(new StrategySimulator()).Compare(inputs);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.RunnerUp.RiskAdjusted.FinalNetWorth, Is.Negative, "the runner-up still owes more than it has");
            Assert.That(comparison.LeadPercent, Is.Null, "so the lead is not given as a percentage of it");
        });
    }

    // ---- PMI: a cost that paying down ends sooner ----

    /// <summary>$370,000 at 6.5% over 30 years on a $400,000 home, with $150 a month of PMI until it is down to $320,000.</summary>
    private static StrategyInputs WithPmi(decimal monthlyPmi = 150m) =>
        TypicalInputs(mortgage: new LoanTerms(370_000m, 6.5m, 360, NextPaymentDate)) with { Pmi = LoanPmi.OnCurrentLoan(monthlyPmi, 400_000m) };

    [Test]
    public void Pmi_IsPaidUntilTheBalanceReaches80PercentOfTheHomesValue_WhichPayingDownBringsSooner()
    {
        var steady = MarketScenario.Steady(MarketScenarioKind.Expected, 10m);
        var scheduled = new AmortizationCalculator().Generate(WithPmi().Mortgage, ExtraPaymentPlan.None, RecastPolicy.Never);
        var lastScheduled = LoanPmi.OnCurrentLoan(150m, 400_000m).LastPaymentOn(scheduled)!.Value;

        var invested = new StrategySimulator().Simulate(WithPmi(), 100m, steady);
        var paidDown = new StrategySimulator().Simulate(WithPmi(), 0m, steady);

        Assert.Multiple(() =>
        {
            Assert.That(invested.MortgageInsuranceEndDate, Is.EqualTo(scheduled.Payments[lastScheduled - 1].DueDate),
                "investing everything pays the loan as scheduled, so PMI runs its scheduled course");
            Assert.That(invested.TotalMortgageInsurance, Is.EqualTo(lastScheduled * 150m), "$150 with every payment until then");
            Assert.That(paidDown.MortgageInsuranceEndDate, Is.LessThan(invested.MortgageInsuranceEndDate!.Value), "paying down reaches 80% years sooner");
            Assert.That(paidDown.TotalMortgageInsurance, Is.LessThan(invested.TotalMortgageInsurance / 2), "and pays less than half the PMI");
            Assert.That(WithPmi(monthlyPmi: 0m).Pmi, Is.EqualTo(LoanPmi.None), "no premium, no PMI");
        });
    }

    [Test]
    public void Pmi_TipsTheBalanceTowardPayingDown()
    {
        var steady = MarketScenario.Steady(MarketScenarioKind.Expected, 10m);
        var simulator = new StrategySimulator();
        double Lead(StrategyInputs inputs) =>
            (double)(simulator.Simulate(inputs, 0m, steady).FinalNetWorth - simulator.Simulate(inputs, 100m, steady).FinalNetWorth);

        Assert.That(Lead(WithPmi()), Is.GreaterThan(Lead(WithPmi(monthlyPmi: 0m))),
            "ending PMI sooner is a return only paying down earns, so it narrows investing's lead or widens paying down's");
    }

    [TestCase(90_000, 1_800, TestName = "AGI under $100,000: all of it")]
    [TestCase(100_000, 1_800, TestName = "AGI of exactly $100,000: all of it")]
    [TestCase(100_000.01, 1_620, TestName = "A cent over: 10% less, for each $1,000 or part of one")]
    [TestCase(105_000, 900, TestName = "$5,000 over: half")]
    [TestCase(105_000.01, 720, TestName = "Just over $5,000 over: 60% less")]
    [TestCase(110_000, 0, TestName = "$10,000 over: none")]
    public void Pmi_IsDeductibleLikeInterest_PhasingOutAbove100kOfIncome(decimal adjustedGrossIncome, decimal expected) =>
        Assert.That(TaxDeductions.DeductiblePmi(1_800m, adjustedGrossIncome), Is.EqualTo(expected),
            "from 2026, PMI is mortgage interest for the deduction, less 10% for each $1,000 of AGI over $100,000 (IRC 163(h)(3)(E))");

    [Test]
    public void Pmi_SavesTaxWhenItemizing_ForAHouseholdUnderTheIncomeLimit_AfterThe401kContribution()
    {
        // $105,000 of pay less the $6,300 401(k) contribution (6% for the match) is $98,700 of income, under $100,000;
        // $40,000 of other deductions means every dollar of interest and PMI is itemized.
        var steady = MarketScenario.Steady(MarketScenarioKind.Expected, 10m);
        StrategyInputs Inputs(decimal pmi) => new StrategyInputs(
            new LoanTerms(370_000m, 6.5m, 360, NextPaymentDate), 400_000m, 4.3m,
            new Household(105_000m, 22m, 15m, FilingStatus.MarriedFilingJointly, 40_000m, 1_000m),
            new EmployerMatch(50m, 6m), StockPurchasePlan.None, 7_500m, new MarketAssumptions(10m, 3m, RiskProfile.Balanced))
        {
            Pmi = LoanPmi.OnCurrentLoan(pmi, 400_000m),
        };

        var withPmi = new StrategySimulator().Simulate(Inputs(150m), 100m, steady);
        var without = new StrategySimulator().Simulate(Inputs(0m), 100m, steady);

        Assert.That(withPmi.TotalTaxSaved - without.TotalTaxSaved, Is.EqualTo(withPmi.TotalMortgageInsurance * 0.22m).Within(1m),
            "each year's PMI saves tax at the 22% rate, all of it: the contribution is not income for the limit");
    }
}
