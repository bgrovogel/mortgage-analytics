namespace MortgageAnalytics.Domain.Strategies;

/// <summary>Plays one strategy out, month by month, in one market scenario.</summary>
public interface IStrategySimulator
{
    /// <summary>Simulates the horizon.</summary>
    /// <param name="inputs">The mortgage, household and market.</param>
    /// <param name="investPercent">The share of extra cash invested while the mortgage is owed (0 pays it off first, 100 invests it all).</param>
    /// <param name="scenario">The market path.</param>
    /// <returns>Net worth year by year, and when the mortgage is paid off and the investments pass it.</returns>
    StrategyProjection Simulate(StrategyInputs inputs, decimal investPercent, MarketScenario scenario);
}

/// <summary>
/// The month-by-month engine behind every comparison. All strategies spend exactly the same cash each
/// month; only where the extra goes differs, so differences in net worth come from the choice alone.
/// </summary>
/// <remarks>
/// Each month, in order:
/// <list type="number">
///   <item>Every account grows by the scenario's monthly return.</item>
///   <item>The required mortgage payment is made: interest at that month's rate, re-amortized at each rate change
///         (see <see cref="MortgagePayments"/>), less any buydown subsidy. The household's budget is what it pays on
///         the mortgage now plus the extra cash, so a reset that raises the payment leaves less cash, and a lower one
///         more. Once the mortgage is gone, the whole budget becomes cash to put to work.</item>
///   <item>The 401(k) contribution and the employer match go in; ESPP savings build up and, at the end of each
///         purchase period, come back with the discount (minus income tax on it).</item>
///   <item>At each year end: RSUs vest (kept as shares, or sold for cash), the ESOP contribution goes in, and the
///         tax saved by deducting that year's mortgage interest (only the part of itemized deductions above the
///         standard deduction, both rising with inflation) comes back as cash.</item>
///   <item>The cash is split: (100 − investPercent)% to extra principal while anything is owed, the rest
///         invested: an IRA up to the yearly amount first, then a taxable account.</item>
/// </list>
/// Stateless, so one instance can be shared.
/// </remarks>
public sealed class StrategySimulator : IStrategySimulator
{
    /// <summary>How long every strategy is played out: 30 years.</summary>
    public const int HorizonInMonths = 360;

    /// <inheritdoc />
    public StrategyProjection Simulate(StrategyInputs inputs, decimal investPercent, MarketScenario scenario)
    {
        if (investPercent is < 0 or > 100)
            throw new DomainValidationException("The share of extra cash invested must be between 0% and 100%.");

        var loan = inputs.Mortgage;
        var household = inputs.Household;
        var espp = inputs.StockPurchasePlan;
        var plan = MonthlyCashPlan.For(inputs);
        var accounts = new InvestmentAccounts(household.CurrentRetirementSavings, household.CurrentInvestments);
        var mortgage = new MortgagePayments(loan, inputs.Buydown);
        var budget = mortgage.HouseholdPaymentNow;

        var balance = loan.Principal;
        var balanceAtYearStart = balance;
        decimal totalInterest = 0m, totalTaxSaved = 0m, interestThisYear = 0m, esppSaved = 0m, iraRoom = 0m;
        int? payoffMonth = null;
        int? crossoverMonth = accounts.AfterTaxValue(household) >= balance ? 0 : null;
        List<NetWorthYear> years = [YearEnd(inputs, 0, balance, accounts, 0m)];

        for (var month = 1; month <= HorizonInMonths; month++)
        {
            var year = (month + 11) / 12;
            var isYearEnd = month % 12 == 0;
            if (month % 12 == 1)
                iraRoom = inputs.AnnualIraContribution;

            accounts.Grow(scenario.MonthlyGrowthFactorInYear(year));
            var cash = plan.ExtraCash;

            // The required payment. A smaller final payment, or none once the loan is gone, frees the rest.
            if (balance > 0)
            {
                var (interest, principal, subsidy) = mortgage.Pay(month, balance);
                balance -= principal;
                totalInterest += interest;
                interestThisYear += interest;
                cash += budget - (interest + principal - subsidy);
            }
            else
            {
                cash += budget;
            }

            // Free money first, in every strategy.
            accounts.AddRetirement(plan.RetirementContribution + plan.EmployerMatch);
            if (plan.EsppContribution > 0)
            {
                esppSaved += plan.EsppContribution;
                if (month % espp.PurchasePeriodMonths == 0)
                {
                    var proceeds = espp.SaleProceeds(esppSaved);
                    cash += proceeds - Money.Round((proceeds - esppSaved) * household.MarginalTaxRate / 100m);
                    esppSaved = 0m;
                }
            }

            if (isYearEnd)
            {
                var priceLevel = DecimalMath.Pow(1 + inputs.Market.InflationRate / 100m, year - 1);
                var taxSaved = TaxDeductions.TaxSavedByInterest(household, TaxDeductions.DeductibleInterest(interestThisYear, balanceAtYearStart), priceLevel);
                totalTaxSaved += taxSaved;
                cash += taxSaved;
                accounts.AddRetirement(household.AnnualEsopContribution);
                if (household.SellRsusAtVest)
                    cash += household.AnnualRsuVesting;
                else
                    accounts.AddTaxable(household.AnnualRsuVesting);
                interestThisYear = 0m;
            }

            // The strategy's choice: extra principal while anything is owed, the rest invested.
            if (balance > 0 && cash > 0)
            {
                var toMortgage = Math.Min(Money.Round(cash * (100m - investPercent) / 100m), balance);
                balance -= toMortgage;
                cash -= toMortgage;
            }
            var toIra = Math.Min(Math.Max(cash, 0m), iraRoom);
            iraRoom -= toIra;
            accounts.AddRoth(toIra);
            accounts.AddTaxable(cash - toIra);

            if (balance == 0 && payoffMonth is null)
                payoffMonth = month;
            if (crossoverMonth is null && accounts.AfterTaxValue(household) + esppSaved >= balance)
                crossoverMonth = month;
            if (isYearEnd)
            {
                years.Add(YearEnd(inputs, year, balance, accounts, esppSaved));
                balanceAtYearStart = balance;
            }
        }

        return new StrategyProjection(
            scenario,
            years,
            totalInterest,
            totalTaxSaved,
            payoffMonth,
            payoffMonth is { } paid ? loan.DueDateOf(paid) : null,
            crossoverMonth,
            crossoverMonth is { } crossed and > 0 ? loan.DueDateOf(crossed) : null);
    }

    // esppSaved: payroll savings waiting in the ESPP for the next purchase are still the household's money.
    private static NetWorthYear YearEnd(StrategyInputs inputs, int year, decimal balance, InvestmentAccounts accounts, decimal esppSaved)
    {
        var homeValue = Growth.Compound(inputs.HomeValue, inputs.HomeGrowthRate, year);
        var investments = accounts.AfterTaxValue(inputs.Household) + esppSaved;
        var netWorth = homeValue - balance + investments;
        var inflation = DecimalMath.Pow(1 + inputs.Market.InflationRate / 100m, year);
        return new NetWorthYear(year, homeValue, balance, investments, netWorth, Money.Round(netWorth / inflation));
    }
}
