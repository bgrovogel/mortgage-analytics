using MortgageAnalytics.Domain.Strategies;
using static MortgageAnalytics.Testing.ReferenceStrategies;

namespace MortgageAnalytics.Domain.Tests.Strategies;

/// <summary>
/// The whole comparison, checked against the independent Python model (<see cref="ReferenceStrategies"/>).
/// Thirty years of monthly rounding have to agree to the cent.
/// </summary>
[TestFixture]
public class StrategyOptimizerTests
{
    private static readonly StrategyOptimizer Optimizer = new(new StrategySimulator());

    private static StrategyOutcome Outcome(StrategyComparison comparison, StrategyKind kind) =>
        comparison.Outcomes.Single(o => o.Kind == kind);

    [Test]
    public void PayingOffFirst_PutsEveryExtraDollarOnTheMortgage_ThenInvestsEverything()
    {
        var payOff = Outcome(Optimizer.Compare(TypicalInputs()), StrategyKind.PayOffFirst);

        Assert.Multiple(() =>
        {
            Assert.That(payOff.InvestPercent, Is.Zero, "nothing is invested while the mortgage is owed");
            Assert.That(payOff.RiskAdjusted.PayoffMonth, Is.EqualTo(Typical.PayOffFirst.PayoffMonth), "the $544 a month clears it in 15½ years");
            Assert.That(payOff.RiskAdjusted.PayoffDate, Is.EqualTo(Typical.PayOffFirst.PayoffDate), "on this date");
            Assert.That(payOff.RiskAdjusted.TotalInterest, Is.EqualTo(Typical.PayOffFirst.TotalInterest), "far less interest");
            Assert.That(payOff.RiskAdjusted.Years[10].MortgageBalance, Is.EqualTo(Typical.PayOffFirst.BalanceAtYear10), "the balance at year 10");
            Assert.That(payOff.RiskAdjusted.Years[5].NetWorth, Is.EqualTo(Typical.PayOffFirst.RiskAdjustedNetWorthAtYear5), "net worth at year 5");
            Assert.That(payOff.RiskAdjusted.FinalNetWorth, Is.EqualTo(Typical.PayOffFirst.RiskAdjustedNetWorthAtYear30), "and at year 30, once the freed payment has been invested for years");
            Assert.That(payOff.RiskAdjusted.Years[30].NetWorthInTodaysDollars, Is.EqualTo(Typical.PayOffFirst.RiskAdjustedNetWorthAtYear30InTodaysDollars), "in today's dollars");
        });
    }

    [Test]
    public void InvestingTheDifference_PaysOnlyWhatIsRequired()
    {
        var invest = Outcome(Optimizer.Compare(TypicalInputs()), StrategyKind.InvestTheDifference);

        Assert.Multiple(() =>
        {
            Assert.That(invest.InvestPercent, Is.EqualTo(100m), "every extra dollar is invested");
            Assert.That(invest.RiskAdjusted.PayoffMonth, Is.EqualTo(Typical.InvestTheDifference.PayoffMonth), "the mortgage runs its course");
            Assert.That(invest.RiskAdjusted.TotalInterest, Is.EqualTo(Typical.InvestTheDifference.TotalInterest), "paying all its interest");
            Assert.That(invest.RiskAdjusted.Years[30].Investments, Is.EqualTo(Typical.InvestTheDifference.RiskAdjustedInvestmentsAtYear30), "investments after 30 years, after tax");
            Assert.That(invest.RiskAdjusted.FinalNetWorth, Is.EqualTo(Typical.InvestTheDifference.RiskAdjustedNetWorthAtYear30), "net worth after 30 years");
        });
    }

    [Test]
    public void TheHybrid_SplitsTheExtraCash_ByTheRateDifference()
    {
        var hybrid = Outcome(Optimizer.Compare(TypicalInputs()), StrategyKind.Hybrid);

        Assert.Multiple(() =>
        {
            Assert.That(hybrid.InvestPercent, Is.EqualTo(Typical.HybridInvestPercent), "8% tax-free in the IRA against a 6.5% mortgage: mostly invested");
            Assert.That(hybrid.RiskAdjusted.PayoffMonth, Is.EqualTo(Typical.Hybrid.PayoffMonth), "paid off between the other two");
            Assert.That(hybrid.RiskAdjusted.FinalNetWorth, Is.EqualTo(Typical.Hybrid.RiskAdjustedNetWorthAtYear30), "and ends between them too");
        });
    }

    [Test]
    public void TheRecommendation_RestsOnTheRiskAdjustedReturn_AndTheBadDecadeCanReverseIt()
    {
        var comparison = Optimizer.Compare(TypicalInputs());

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Recommended.Kind, Is.EqualTo(StrategyKind.InvestTheDifference), "at a risk-adjusted 8%, investing ends highest");
            Assert.That(comparison.RunnerUp.Kind, Is.EqualTo(StrategyKind.Hybrid), "the hybrid is next");
            Assert.That(comparison.Lead, Is.EqualTo(Typical.InvestTheDifference.RiskAdjustedNetWorthAtYear30 - Typical.Hybrid.RiskAdjustedNetWorthAtYear30), "by this much");
            Assert.That(comparison.LeadPercent, Is.EqualTo(0.5m), "a small edge, as a percentage of the runner-up");
            Assert.That(comparison.WinnerIn(MarketScenarioKind.BadDecade).Kind, Is.EqualTo(StrategyKind.PayOffFirst),
                "a lost decade first, and the guaranteed return of paying off wins");
            Assert.That(Outcome(comparison, StrategyKind.PayOffFirst).BadDecade.FinalNetWorth, Is.EqualTo(Typical.PayOffFirst.BadDecadeNetWorthAtYear30), "pay off first, bad decade");
            Assert.That(Outcome(comparison, StrategyKind.InvestTheDifference).BadDecade.FinalNetWorth, Is.EqualTo(Typical.InvestTheDifference.BadDecadeNetWorthAtYear30), "invest, bad decade");
            Assert.That(Outcome(comparison, StrategyKind.PayOffFirst).Expected.FinalNetWorth, Is.EqualTo(Typical.PayOffFirst.ExpectedNetWorthAtYear30), "pay off first, expected return");
        });
    }

    [Test]
    public void PayingDownTheMortgage_EarnsTheSameWhateverTheMarketDoes()
    {
        var payOff = Outcome(Optimizer.Compare(TypicalInputs()), StrategyKind.PayOffFirst);

        Assert.Multiple(() =>
        {
            Assert.That(payOff.BadDecade.PayoffMonth, Is.EqualTo(payOff.Expected.PayoffMonth), "the payoff date does not depend on the market");
            Assert.That(payOff.BadDecade.TotalInterest, Is.EqualTo(payOff.Expected.TotalInterest), "and neither does the interest saved");
        });
    }

    [Test]
    public void TheCrossover_IsWhenInvestmentsFirstCoverTheMortgage()
    {
        var payOff = Outcome(Optimizer.Compare(TypicalInputs()), StrategyKind.PayOffFirst).RiskAdjusted;

        Assert.Multiple(() =>
        {
            Assert.That(payOff.CrossoverMonth, Is.EqualTo(Typical.PayOffFirst.RiskAdjustedCrossoverMonth), "the first month investments (after tax) ≥ the balance");
            Assert.That(payOff.CrossoverDate, Is.EqualTo(Typical.PayOffFirst.RiskAdjustedCrossoverDate), "and its date");
            Assert.That(payOff.Years[7].Investments, Is.LessThan(payOff.Years[7].MortgageBalance), "before it, the mortgage is larger");
            Assert.That(payOff.Years[8].Investments, Is.GreaterThanOrEqualTo(payOff.Years[8].MortgageBalance), "after it, the investments are");
        });
    }

    [Test]
    public void StockThatArrivesAnyway_SendsTheHybridsExtraCashToTheMortgage()
    {
        var comparison = Optimizer.Compare(TypicalInputs(annualRsuVesting: 50_000m, annualEsopContribution: 5_000m));
        var payOff = Outcome(comparison, StrategyKind.PayOffFirst);
        var hybrid = Outcome(comparison, StrategyKind.Hybrid);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Rates.AutomaticAnnualStock, Is.EqualTo(55_000m), "RSUs kept as shares plus the ESOP");
            Assert.That(hybrid.InvestPercent, Is.EqualTo(StockHeavy.HybridInvestPercent), "already more in stock than the hybrid's 88% target");
            Assert.That(hybrid.RiskAdjusted.FinalNetWorth, Is.EqualTo(payOff.RiskAdjusted.FinalNetWorth), "so the hybrid becomes paying off first");
            Assert.That(payOff.RiskAdjusted.FinalNetWorth, Is.EqualTo(StockHeavy.PayOffFirstRiskAdjustedNetWorthAtYear30), "the RSUs and ESOP grow in every strategy");
            Assert.That(payOff.RiskAdjusted.Years[30].Investments, Is.EqualTo(StockHeavy.PayOffFirstRiskAdjustedInvestmentsAtYear30), "investments, after tax");
        });
    }

    [Test]
    public void RsusSoldAtVest_AreCashTheStrategyDirects()
    {
        var kept = Optimizer.Compare(TypicalInputs(annualRsuVesting: 30_000m));
        var sold = Optimizer.Compare(TypicalInputs(annualRsuVesting: 30_000m, sellRsusAtVest: true));

        Assert.Multiple(() =>
        {
            Assert.That(sold.Rates.AutomaticAnnualStock, Is.Zero, "sold RSUs are not stock held");
            Assert.That(sold.Rates.HybridInvestPercent, Is.EqualTo(sold.Rates.TargetInvestPercent), "so the hybrid keeps its rate-based split");
            Assert.That(sold.Rates.IraShelteredPercent, Is.EqualTo(21m), "and only $7,500 of the $36,528 a year fits in the IRA");
            Assert.That(Outcome(sold, StrategyKind.PayOffFirst).RiskAdjusted.PayoffMonth, Is.LessThan(Outcome(kept, StrategyKind.PayOffFirst).RiskAdjusted.PayoffMonth!.Value),
                "paying off first, the proceeds go on the mortgage");
        });
    }

    [Test]
    public void DeductedInterest_LowersTheMortgagesEffectiveRate_AndTheTaxSavedComesBackAsCash()
    {
        var comparison = Optimizer.Compare(ItemizerInputs());

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Rates.FirstYearInterest, Is.EqualTo(Itemizer.FirstYearInterest), "$48,775 of interest in year 1");
            Assert.That(comparison.Rates.InterestIsDeducted, Is.True, "with $15,000 of other deductions, itemizing beats the $16,100 standard deduction");
            Assert.That(comparison.Rates.FirstYearTaxSaved, Is.EqualTo(Itemizer.FirstYearTaxSaved), "only the part above the standard deduction saves tax");
            Assert.That(comparison.Rates.AfterTaxMortgageRate, Is.EqualTo(Itemizer.AfterTaxMortgageRate), "so paying down 7% earns 4.55% after tax");
            Assert.That(Outcome(comparison, StrategyKind.InvestTheDifference).RiskAdjusted.TotalTaxSaved, Is.EqualTo(Itemizer.InvestTheDifferenceTotalTaxSaved), "30 years of deductions");
            Assert.That(Outcome(comparison, StrategyKind.PayOffFirst).RiskAdjusted.TotalTaxSaved, Is.EqualTo(Itemizer.PayOffFirstTotalTaxSaved), "paying off early gives up most of them");
        });
    }

    [Test]
    public void TheStandardDeduction_MeansInterestSavesNoTax()
    {
        var rates = Optimizer.Compare(TypicalInputs()).Rates;

        Assert.Multiple(() =>
        {
            Assert.That(rates.InterestIsDeducted, Is.False, "$19,354 of interest plus $10,000 is under the $32,200 joint standard deduction");
            Assert.That(rates.FirstYearTaxSaved, Is.Zero, "so it saves nothing");
            Assert.That(rates.AfterTaxMortgageRate, Is.EqualTo(6.5m), "and paying it down earns the full rate");
        });
    }

    [Test]
    public void EsppGains_AreExtraCash_ThatTheStrategyDirects()
    {
        var comparison = Optimizer.Compare(TypicalInputs(monthlyCash: 2_000m, stockPurchasePlan: WithEspp.Plan));
        var payOff = Outcome(comparison, StrategyKind.PayOffFirst);

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Plan.EsppContribution, Is.EqualTo(WithEspp.MonthlyContribution), "10% of pay");
            Assert.That(payOff.RiskAdjusted.PayoffMonth, Is.EqualTo(WithEspp.PayOffFirstPayoffMonth), "the proceeds, discount and all, go on the mortgage");
            Assert.That(payOff.RiskAdjusted.FinalNetWorth, Is.EqualTo(WithEspp.PayOffFirstRiskAdjustedNetWorthAtYear30), "net worth after 30 years");
        });
    }

    [Test]
    public void ATie_GoesToPayingOffFirst_TheLessRiskyChoice()
    {
        // With no cash to put to work there is nothing to choose: every strategy ends the same.
        var comparison = Optimizer.Compare(TypicalInputs(monthlyCash: 0m));

        Assert.Multiple(() =>
        {
            Assert.That(comparison.Outcomes.Select(o => o.RiskAdjusted.FinalNetWorth).Distinct().Count(), Is.EqualTo(1), "identical results");
            Assert.That(comparison.Recommended.Kind, Is.EqualTo(StrategyKind.PayOffFirst), "the tie goes to the guaranteed return");
            Assert.That(comparison.Lead, Is.Zero, "with no lead");
        });
    }
}
