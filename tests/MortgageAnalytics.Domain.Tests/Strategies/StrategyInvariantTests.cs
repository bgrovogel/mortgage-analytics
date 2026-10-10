using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Strategies;
using static MortgageAnalytics.Testing.ReferenceStrategies;

namespace MortgageAnalytics.Domain.Tests.Strategies;

/// <summary>
/// Checks the simulator against facts that hold whatever the numbers: textbook formulas and accounting
/// identities. They complement the reference values (one worked household) by covering every household.
/// </summary>
[TestFixture]
public class StrategyInvariantTests
{
    private static readonly StrategyOptimizer Optimizer = new(new StrategySimulator());

    /// <summary>No taxes, no match, no IRA, nothing saved yet, and whatever market return is given.</summary>
    private static StrategyInputs PlainHousehold(decimal marketReturn, decimal monthlyCash = 544m) =>
        TypicalInputs(
            match: EmployerMatch.None,
            market: new MarketAssumptions(marketReturn, 0m, RiskProfile.Aggressive)) is var typical
            ? new StrategyInputs(
                typical.Mortgage,
                typical.HomeValue,
                typical.HomeGrowthRate,
                new Household(120_000m, 0m, 0m, FilingStatus.MarriedFilingJointly, 0m, monthlyCash),
                EmployerMatch.None,
                StockPurchasePlan.None,
                annualIraContribution: 0m,
                typical.Market)
            : throw new InvalidOperationException();

    private static StrategyOutcome Outcome(StrategyComparison comparison, StrategyKind kind) =>
        comparison.Outcomes.Single(o => o.Kind == kind);

    [Test]
    public void AtAZeroReturn_PayingOffFirstEndsAheadByExactlyTheInterestItAvoids()
    {
        var comparison = Optimizer.Compare(PlainHousehold(marketReturn: 0m));
        var payOff = Outcome(comparison, StrategyKind.PayOffFirst).Expected;
        var invest = Outcome(comparison, StrategyKind.InvestTheDifference).Expected;

        Assert.That(payOff.FinalNetWorth - invest.FinalNetWorth, Is.EqualTo(invest.TotalInterest - payOff.TotalInterest),
            "with money earning nothing, every dollar of interest avoided is a dollar more net worth, to the cent");
    }

    [TestCase(0)]
    [TestCase(544)]
    [TestCase(2_000)]
    public void ThePayoffMonth_MatchesTheTextbookNperFormula(decimal extra)
    {
        var inputs = PlainHousehold(marketReturn: 8m, monthlyCash: extra);
        var plan = MonthlyCashPlan.For(inputs);
        var monthlyRate = 0.065 / 12;
        var nper = -Math.Log(1 - monthlyRate * 300_000 / (double)(plan.MortgagePayment + extra)) / Math.Log(1 + monthlyRate);

        var payOff = Outcome(Optimizer.Compare(inputs), StrategyKind.PayOffFirst).Expected;

        // The payment is rounded to cents, so with no extra NPER lands a hair over the term (300.0000x); the
        // last scheduled payment absorbs that fraction of a cent, as on any real loan.
        Assert.That(payOff.PayoffMonth, Is.EqualTo(Math.Min((int)Math.Ceiling(nper), 300)),
            $"n = −ln(1 − rB/P) ÷ ln(1 + r) = {nper:F4} months, rounded up, and never past the term");
    }

    [Test]
    public void EveryYear_NetWorthIsTheHomeLessTheMortgagePlusTheInvestments()
    {
        var comparison = Optimizer.Compare(TypicalInputs(annualRsuVesting: 10_000m, stockPurchasePlan: WithEspp.Plan, monthlyCash: 2_000m));

        var broken = comparison.Outcomes
            .SelectMany(o => new[] { o.Expected, o.RiskAdjusted, o.BadDecade }.SelectMany(p => p.Years).Select(y => (o.Kind, y)))
            .Where(x => x.y.NetWorth != x.y.HomeValue - x.y.MortgageBalance + x.y.Investments)
            .Select(x => $"{x.Kind} year {x.y.Year}")
            .ToList();

        Assert.That(broken, Is.Empty, "net worth is defined as home equity plus investments, in every strategy, scenario and year");
    }

    [Test]
    public void EsppSavingsWaitingForAPurchase_StillCountAsYours()
    {
        // Buying every 5 months, a year end usually falls between purchases.
        var inputs = TypicalInputs(monthlyCash: 2_000m, stockPurchasePlan: new StockPurchasePlan(10m, 15m, 5));
        var year1 = Outcome(Optimizer.Compare(inputs), StrategyKind.InvestTheDifference).Expected.Years[1];
        var withoutEspp = Outcome(Optimizer.Compare(TypicalInputs(monthlyCash: 1_000m)), StrategyKind.InvestTheDifference).Expected.Years[1];

        // Year 1: two purchases (months 5 and 10) and $2,000 of months 11-12 still in the plan, all on top of the $1,000-a-month household.
        Assert.That(year1.Investments - withoutEspp.Investments, Is.GreaterThan(12_000m),
            "the $12,000 put in over the year is never missing, whether it has bought shares yet or not");
    }

    [Test]
    public void TheHomeValue_IsTheSameWhicheverStrategyIsChosen()
    {
        var comparison = Optimizer.Compare(TypicalInputs());

        Assert.That(comparison.Outcomes.Select(o => o.RiskAdjusted.Years[^1].HomeValue).Distinct().Count(), Is.EqualTo(1),
            "only the mortgage and the investments can differ between strategies");
    }

    [Test]
    public void TheMoreTheMarketReturns_TheFurtherInvestingPullsAhead()
    {
        decimal Lead(decimal marketReturn)
        {
            var comparison = Optimizer.Compare(PlainHousehold(marketReturn));
            return Outcome(comparison, StrategyKind.InvestTheDifference).Expected.FinalNetWorth
                - Outcome(comparison, StrategyKind.PayOffFirst).Expected.FinalNetWorth;
        }

        var leads = new[] { 0m, 4m, 6.5m, 8m, 12m }.Select(Lead).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(leads, Is.Ordered.Ascending, "a higher return always helps the strategy that invests more");
            Assert.That(leads[0], Is.Negative, "earning nothing, paying off wins");
            Assert.That(leads[^1], Is.Positive, "earning 12%, investing wins");
        });
    }
}
