using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Refinancing;
using MortgageAnalytics.Domain.Strategies;
using static MortgageAnalytics.Testing.ReferenceStrategies;

namespace MortgageAnalytics.Domain.Tests;

/// <summary>
/// The limits of every domain guard, one row each: the value at the limit is accepted, and the value just past it is
/// rejected with that guard's own message. Mutation testing showed why this table exists: a limit such as "at most 120"
/// could be changed to "less than 120", a guard's message emptied, or a whole guard deleted, and no test noticed.
/// </summary>
[TestFixture]
public class GuardLimitTests
{
    private static readonly LoanTerms Loan = new(200_000m, 6m, 360, new DateOnly(2026, 1, 1));

    public static IEnumerable<TestCaseData> Limits()
    {
        // Adjustable rates
        yield return Limit("ARM: a one-payment fixed period", () => Arm(fixedMonths: 1), () => Arm(fixedMonths: 0), "The fixed period");
        yield return Limit("ARM: a fixed period shorter than the longest term", () => Arm(fixedMonths: 599), () => Arm(fixedMonths: 600), "The fixed period");
        yield return Limit("ARM: a reset every month", () => Arm(interval: 1), () => Arm(interval: 0), "reset every 1 to 120 months");
        yield return Limit("ARM: a reset every 120 months", () => Arm(interval: 120), () => Arm(interval: 121), "reset every 1 to 120 months");
        yield return Limit("ARM: an expected rate of 0%", () => Arm(expected: 0m), () => Arm(expected: -0.01m), "The expected rate");
        yield return Limit("ARM: an expected rate of 30%", () => Arm(expected: 30m), () => Arm(expected: 30.01m), "The expected rate");
        yield return Limit("ARM: a first-reset cap of 0", () => Arm(initialCap: 0m), () => Arm(initialCap: -0.01m), "Caps must be");
        yield return Limit("ARM: a first-reset cap of 10", () => Arm(initialCap: 10m), () => Arm(initialCap: 10.01m), "Caps must be");
        yield return Limit("ARM: a periodic cap of 0", () => Arm(periodicCap: 0m), () => Arm(periodicCap: -0.01m), "Caps must be");
        yield return Limit("ARM: a periodic cap of 10", () => Arm(periodicCap: 10m), () => Arm(periodicCap: 10.01m), "Caps must be");
        yield return Limit("ARM: a lifetime cap of 0", () => Arm(lifetimeCap: 0m), () => Arm(lifetimeCap: -0.01m), "Caps must be");
        yield return Limit("ARM: a lifetime cap of 10", () => Arm(lifetimeCap: 10m), () => Arm(lifetimeCap: 10.01m), "Caps must be");
        yield return Limit("ARM: a margin of 0%", () => Arm() with { Margin = 0m }, () => Arm() with { Margin = -0.01m }, "The margin");
        yield return Limit("ARM: a margin of 30%", () => Arm() with { Margin = 30m }, () => Arm() with { Margin = 30.01m }, "The margin");
        yield return Limit("A rate change on the last payment", () => Loan.WithRateChanges([new RateChange(360, 7m)]),
            () => Loan.WithRateChanges([new RateChange(361, 7m)]), "within the term");
        yield return Limit("A changed rate of 0%", () => Loan.WithRateChanges([new RateChange(13, 0m)]), () => Loan.WithRateChanges([new RateChange(13, -0.01m)]), "A changed rate");
        yield return Limit("A changed rate of 30%", () => Loan.WithRateChanges([new RateChange(13, 30m)]), () => Loan.WithRateChanges([new RateChange(13, 30.01m)]), "A changed rate");

        // Temporary buydowns
        yield return Limit("Buydown: one year", () => new TemporaryBuydown([1m]), () => new TemporaryBuydown([]), "covers 1 to 3 years");
        yield return Limit("Buydown: three years", () => new TemporaryBuydown([1m, 1m, 1m]), () => new TemporaryBuydown([1m, 1m, 1m, 1m]), "covers 1 to 3 years");
        yield return Limit("Buydown: the smallest reduction", () => new TemporaryBuydown([0.01m]), () => new TemporaryBuydown([0m]), "Each year's reduction");
        yield return Limit("Buydown: a 3-point reduction, even when one later year is too large", () => new TemporaryBuydown([3m]),
            () => new TemporaryBuydown([2m, 3.01m]), "Each year's reduction");

        // Refinance offers
        yield return Limit("Refinance: a 0% rate", () => Offer(rate: 0m), () => Offer(rate: -0.01m), "Annual interest rate");
        yield return Limit("Refinance: a 30% rate", () => Offer(rate: 30m), () => Offer(rate: 30.01m), "Annual interest rate");
        yield return Limit("Refinance: a one-month term", () => Offer(term: 1), () => Offer(term: 0), "Term must be");
        yield return Limit("Refinance: a 600-month term", () => Offer(term: 600), () => Offer(term: 601), "Term must be");
        yield return Limit("Refinance: no closing costs", () => Offer(closingCosts: 0m), () => Offer(closingCosts: -0.01m), "Closing costs");
        yield return Limit("Refinance: the largest closing costs", () => Offer(closingCosts: LoanTerms.MaxPrincipal),
            () => Offer(closingCosts: LoanTerms.MaxPrincipal + 0.01m), "Closing costs");

        // Pay off or invest
        yield return Limit("Match: none", () => new EmployerMatch(0m, 6m), () => new EmployerMatch(-0.01m, 6m), "The employer match");
        yield return Limit("Match: 200%", () => new EmployerMatch(200m, 6m), () => new EmployerMatch(200.01m, 6m), "The employer match");
        yield return Limit("Match: on none of pay", () => new EmployerMatch(50m, 0m), () => new EmployerMatch(50m, -0.01m), "The matched share of pay");
        yield return Limit("Match: on all of pay", () => new EmployerMatch(50m, 100m), () => new EmployerMatch(50m, 100.01m), "The matched share of pay");
        yield return Limit("Market: a -10% expected return", () => Market(expected: -10m), () => Market(expected: -10.01m), "The expected market return");
        yield return Limit("Market: a 30% expected return", () => Market(expected: 30m), () => Market(expected: 30.01m), "The expected market return");
        yield return Limit("Market: -5% inflation", () => Market(inflation: -5m), () => Market(inflation: -5.01m), "Inflation must be");
        yield return Limit("Market: 20% inflation", () => Market(inflation: 20m), () => Market(inflation: 20.01m), "Inflation must be");
        yield return Limit("Market: a known risk profile", () => Market(), () => Market(profile: (RiskProfile)99), "Unknown risk profile");
        yield return Limit("Scenario: a -50% year", () => MarketScenario.Steady(MarketScenarioKind.Expected, -50m),
            () => MarketScenario.Steady(MarketScenarioKind.Expected, -50.01m), "An annual market return");
        yield return Limit("Scenario: a 50% year", () => MarketScenario.Steady(MarketScenarioKind.Expected, 50m),
            () => MarketScenario.Steady(MarketScenarioKind.Expected, 50.01m), "An annual market return");
        yield return Limit("ESPP: no contribution", () => Espp(contribution: 0m), () => Espp(contribution: -0.01m), "ESPP contributions");
        yield return Limit("ESPP: 25% of pay", () => Espp(contribution: 25m), () => Espp(contribution: 25.01m), "ESPP contributions");
        yield return Limit("ESPP: no discount", () => Espp(discount: 0m), () => Espp(discount: -0.01m), "An ESPP discount");
        yield return Limit("ESPP: a 15% discount", () => Espp(discount: 15m), () => Espp(discount: 15.01m), "An ESPP discount");
        yield return Limit("ESPP: a one-month period", () => Espp(period: 1), () => Espp(period: 0), "An ESPP purchase period");
        yield return Limit("ESPP: a 27-month period", () => Espp(period: 27), () => Espp(period: 28), "An ESPP purchase period");
        yield return Limit("Inputs: a home worth nothing", () => Inputs(homeValue: 0m), () => Inputs(homeValue: -0.01m), "Home value must be");
        yield return Limit("Inputs: the most valuable home", () => Inputs(homeValue: Household.MaxAmount),
            () => Inputs(homeValue: Household.MaxAmount + 0.01m), "Home value must be");
        yield return Limit("Inputs: home values falling 20% a year", () => Inputs(growth: -20m), () => Inputs(growth: -20.01m), "Home value growth");
        yield return Limit("Inputs: home values rising 25% a year", () => Inputs(growth: 25m), () => Inputs(growth: 25.01m), "Home value growth");
        yield return Limit("Inputs: no IRA", () => Inputs(ira: 0m), () => Inputs(ira: -0.01m), "IRA contributions");
        yield return Limit("Inputs: the IRA limit", () => Inputs(ira: TaxLimits.IraContribution),
            () => Inputs(ira: TaxLimits.IraContribution + 0.01m), "IRA contributions");

        // Households: every amount is capped, every rate too, each by its own guard
        const decimal max = Household.MaxAmount, over = Household.MaxAmount + 0.01m;
        yield return Limit("Household: gross income", () => Home(gross: max), () => Home(gross: over), "Gross annual income");
        yield return Limit("Household: marginal tax rate", () => Home(marginal: 60m), () => Home(marginal: 60.01m), "Marginal tax rate");
        yield return Limit("Household: capital gains tax rate", () => Home(capitalGains: 60m), () => Home(capitalGains: 60.01m), "Capital gains tax rate");
        yield return Limit("Household: a known filing status", () => Home(), () => Home(filing: (FilingStatus)99), "Unknown filing status");
        yield return Limit("Household: other itemized deductions", () => Home(itemized: max), () => Home(itemized: over), "Other itemized deductions");
        yield return Limit("Household: monthly cash", () => Home(monthlyCash: max), () => Home(monthlyCash: over), "Monthly cash to put to work");
        yield return Limit("Household: RSU vesting", () => Home(rsus: max), () => Home(rsus: over), "Yearly RSU vesting");
        yield return Limit("Household: ESOP contribution", () => Home(esop: max), () => Home(esop: over), "Yearly ESOP contribution");
        yield return Limit("Household: retirement savings", () => Home(retirement: max), () => Home(retirement: over), "Current retirement savings");
        yield return Limit("Household: investments", () => Home(investments: max), () => Home(investments: over), "Current investments");

        // Ownership costs and extra payments
        yield return Limit("Fixed cost: one year", () => new AnnualFixedCost(HousingCostCategory.PidAssessment, 1_200m, 1),
            () => new AnnualFixedCost(HousingCostCategory.PidAssessment, 1_200m, 0), "duration must be at least one year");
        yield return Limit("Valuation: no assessment cap growth", () => new PropertyValuation(400_000m, 4m, 0m),
            () => new PropertyValuation(400_000m, 4m, -0.01m), "An assessment cap");
        yield return Limit("Senior relief: no additional exemption", () => new SeniorTaxRelief(5, 0m, true),
            () => new SeniorTaxRelief(5, -0.01m, true), "An additional exemption");
        yield return Limit("Exemption: 100% of the value", () => new TaxExemption(percent: 100m), () => new TaxExemption(percent: 100.01m), "An exemption percentage");
        yield return Limit("Extra payment: nothing extra", () => new MonthlyExtraPayment(0m), () => new MonthlyExtraPayment(-0.01m), "cannot be negative");
    }

    [TestCaseSource(nameof(Limits))]
    public void TheLimitIsAccepted_AndJustPastItIsRejected_ByItsOwnGuard(Func<object?> atLimit, Func<object?> pastLimit, string message)
    {
        Assert.Multiple(() =>
        {
            DomainAssert.Accepts(atLimit, "the limit itself is allowed");
            DomainAssert.Rejects(pastLimit, message, "just past the limit is refused, by the guard for this value");
        });
    }

    private static TestCaseData Limit(string name, Func<object?> atLimit, Func<object?> pastLimit, string message) =>
        new TestCaseData(atLimit, pastLimit, message).SetName(name);

    private static AdjustableRate Arm(int fixedMonths = 84, int interval = 12, decimal expected = 7m,
        decimal initialCap = 2m, decimal periodicCap = 1m, decimal lifetimeCap = 5m) =>
        new(fixedMonths, interval, expected, initialCap, periodicCap, lifetimeCap);

    private static RefinanceOffer Offer(decimal rate = 6m, int term = 360, decimal closingCosts = 5_000m) =>
        new(rate, term, closingCosts, financeClosingCosts: false);

    private static MarketAssumptions Market(decimal expected = 10m, decimal inflation = 3m, RiskProfile profile = RiskProfile.Balanced) =>
        new(expected, inflation, profile);

    private static StockPurchasePlan Espp(decimal contribution = 10m, decimal discount = 15m, int period = 6) =>
        new(contribution, discount, period);

    private static StrategyInputs Inputs(decimal homeValue = 400_000m, decimal growth = 4m, decimal ira = 7_000m)
    {
        var typical = TypicalInputs();
        return new StrategyInputs(typical.Mortgage, homeValue, growth, typical.Household, typical.Match, typical.StockPurchasePlan, ira, typical.Market);
    }

    private static Household Home(decimal gross = 120_000m, decimal marginal = 24m, decimal capitalGains = 15m,
        FilingStatus filing = FilingStatus.SingleFiler, decimal itemized = 0m, decimal monthlyCash = 500m, decimal rsus = 0m,
        decimal esop = 0m, decimal retirement = 0m, decimal investments = 0m) =>
        new(gross, marginal, capitalGains, filing, itemized, monthlyCash, rsus, sellRsusAtVest: false, esop, retirement, investments);
}
