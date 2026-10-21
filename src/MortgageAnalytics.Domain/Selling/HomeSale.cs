using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Domain.Selling;

/// <summary>How a sale is weighed: what it costs, and how the gain is taxed.</summary>
/// <param name="SellingCostPercent">What selling costs, as a percentage of the home's value then: commissions and the seller's closing costs.</param>
/// <param name="FilingStatus">How the seller files, which sets the gain excluded from tax on a home they lived in.</param>
/// <param name="GainsTaxRatePercent">The federal rate on a long-term capital gain (0, 15 or 20%, and 3.8% more at high incomes), as a percentage.</param>
/// <param name="IsPrimaryResidence">True when the seller lives in the home, which is what earns the exclusion.</param>
public sealed record SaleAssumptions(decimal SellingCostPercent, FilingStatus FilingStatus, decimal GainsTaxRatePercent, bool IsPrimaryResidence)
{
    /// <summary>The most a gains tax rate can be, as a percentage: 20% and 3.8% on net investment income is 23.8%, and states add theirs.</summary>
    public const decimal MaxGainsTaxRate = 40m;

    /// <summary>Checks the assumptions are ones a market could have.</summary>
    /// <exception cref="DomainValidationException">A percentage is out of range.</exception>
    public SaleAssumptions Validated()
    {
        if (SellingCostPercent is < 0 or > 20)
            throw new DomainValidationException("Selling costs must be 0% to 20% of the home's value.");
        if (GainsTaxRatePercent is < 0 or > MaxGainsTaxRate)
            throw new DomainValidationException($"The tax rate on the gain must be between 0% and {MaxGainsTaxRate}%.");
        return this;
    }
}

/// <summary>What selling at the end of a year would leave.</summary>
/// <param name="Year">The 1-based year the sale closes at the end of.</param>
/// <param name="HomeValue">What the home sells for.</param>
/// <param name="LoanBalance">What is owed then, paid off from the sale.</param>
/// <param name="SellingCosts">Commissions and the seller's closing costs.</param>
/// <param name="Gain">What the sale nets over the price paid (the value less the selling costs, less the price); negative for a loss.</param>
/// <param name="TaxFreeGain">The part of the gain the exclusion shelters.</param>
/// <param name="TaxOnGain">The federal tax on the rest of the gain.</param>
/// <param name="NetProceeds">What the seller is left with after the loan, the costs and the tax; negative when the sale does not cover them.</param>
public sealed record SaleYear(int Year, decimal HomeValue, decimal LoanBalance, decimal SellingCosts, decimal Gain, decimal TaxFreeGain, decimal TaxOnGain, decimal NetProceeds);

/// <summary>
/// What selling the home would leave in hand, for each year it might be sold. The gain is the sale, less its costs, over
/// the price paid (what buying cost besides the price, and any improvements, would raise the basis and lower the gain, so
/// this leans toward the tax being higher). A home the seller lives in has the first $250,000 of gain ($500,000 for a
/// married couple filing jointly) free of tax once they have owned it two years (IRC 121); a loss is not deductible.
/// </summary>
public static class HomeSale
{
    /// <summary>The gain excluded from tax on a home lived in for two years, for a single filer or head of household.</summary>
    public const decimal Exclusion = 250_000m;

    /// <summary>The gain excluded for a married couple filing jointly.</summary>
    public const decimal JointExclusion = 500_000m;

    /// <summary>The years of ownership after which the exclusion applies.</summary>
    public const int YearsToQualify = 2;

    /// <summary>The gain a sale could shelter from tax once the home has been owned two years.</summary>
    /// <param name="status">How the seller files.</param>
    /// <param name="isPrimaryResidence">True when the seller lives in the home; no other home earns the exclusion.</param>
    public static decimal ExclusionFor(FilingStatus status, bool isPrimaryResidence) =>
        !isPrimaryResidence ? 0m : status == FilingStatus.MarriedFilingJointly ? JointExclusion : Exclusion;

    /// <summary>The proceeds of a sale at the end of each year.</summary>
    /// <param name="purchasePrice">What was paid for the home.</param>
    /// <param name="valuation">The home's market value, year by year.</param>
    /// <param name="balances">What is owed at the end of each year, from year 1; the years covered are as many as these.</param>
    /// <param name="assumptions">What selling costs, and how the gain is taxed.</param>
    /// <exception cref="DomainValidationException">An assumption is out of range.</exception>
    public static IReadOnlyList<SaleYear> Years(
        decimal purchasePrice, PropertyValuation valuation, IReadOnlyList<decimal> balances, SaleAssumptions assumptions)
    {
        assumptions.Validated();
        var exclusion = ExclusionFor(assumptions.FilingStatus, assumptions.IsPrimaryResidence);

        var years = new List<SaleYear>(balances.Count);
        for (var year = 1; year <= balances.Count; year++)
        {
            var value = valuation.MarketValueInYear(year);
            var costs = Money.Round(value * assumptions.SellingCostPercent / 100m);
            var gain = value - costs - purchasePrice;
            var taxFree = year >= YearsToQualify ? Math.Min(Math.Max(gain, 0m), exclusion) : 0m;
            var tax = Money.Round((Math.Max(gain, 0m) - taxFree) * assumptions.GainsTaxRatePercent / 100m);
            years.Add(new SaleYear(year, value, balances[year - 1], costs, gain, taxFree, tax, value - balances[year - 1] - costs - tax));
        }
        return years;
    }
}
