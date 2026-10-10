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
        var plan = MonthlyCashPlan.For(TypicalInputs(monthlyCash: 228m, stockPurchasePlan: WithEspp.Plan));

        Assert.Multiple(() =>
        {
            Assert.That(plan.RetirementContribution, Is.EqualTo(300m), "$228 of take-home pay covers a $300 pre-tax contribution");
            Assert.That(plan.RetirementContributionCost, Is.EqualTo(228m), "all of it");
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

    [TestCase(RiskProfile.Aggressive, 100, TestName = "Aggressive: 10% tax-free in the IRA beats 6.5% by 3.5 points, all invested")]
    [TestCase(RiskProfile.Balanced, 88, TestName = "Balanced: 8% against 6.5%, mostly invested")]
    [TestCase(RiskProfile.Conservative, 38, TestName = "Conservative: 6% against 6.5%, mostly to the mortgage")]
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

        // Target 88% of $8,528 of new savings is $7,505; the ESOP brings $2,000, so $5,505 of the $6,528 extra.
        Assert.That(rates.HybridInvestPercent, Is.EqualTo(84m), "the ESOP counts toward the market's share");
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
            Assert.That(fits.IraShelteredPercent, Is.EqualTo(100m), "$6,528 a year fits in the $7,500 IRA");
            Assert.That(fits.AfterTaxRiskAdjustedReturn, Is.EqualTo(8m), "so it keeps the whole 8%");
            Assert.That(fits.TaxableAfterTaxReturn, Is.EqualTo(Typical.TaxableAfterTaxReturn), "a taxable account would keep 7.41%: tax is paid once, on selling");
            Assert.That(overflows.IraShelteredPercent, Is.EqualTo(25m), "$7,500 of $30,528 a year fits in the IRA (24.6%)");
            // 25% at 8% and 75% at 7.41% = 7.5575, rounded.
            Assert.That(overflows.AfterTaxRiskAdjustedReturn, Is.EqualTo(7.56m), "a blend of the two");
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
}
