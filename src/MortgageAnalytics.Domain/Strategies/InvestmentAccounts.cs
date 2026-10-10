namespace MortgageAnalytics.Domain.Strategies;

/// <summary>
/// The three kinds of account a strategy invests through. They grow alike but are taxed differently, so
/// their value is always reported after the tax still owed on them, or a 401(k) would look richer than it is.
/// </summary>
/// <param name="retirement">Pre-tax savings today (401(k), traditional IRA).</param>
/// <param name="taxable">Taxable investments today, counted as bought at today's value.</param>
internal sealed class InvestmentAccounts(decimal retirement, decimal taxable)
{
    /// <summary>Pre-tax money: income tax is owed when it comes out.</summary>
    public decimal Retirement { get; private set; } = retirement;

    /// <summary>Roth IRA money: already taxed, and grows tax-free.</summary>
    public decimal Roth { get; private set; }

    /// <summary>A taxable brokerage account.</summary>
    public decimal Taxable { get; private set; } = taxable;

    /// <summary>What was paid into <see cref="Taxable"/>: only the growth above it is taxed.</summary>
    public decimal TaxableBasis { get; private set; } = taxable;

    /// <summary>One month of market growth on every account.</summary>
    /// <param name="factor">What a dollar grows to this month.</param>
    public void Grow(decimal factor)
    {
        Retirement = Money.Round(Retirement * factor);
        Roth = Money.Round(Roth * factor);
        Taxable = Money.Round(Taxable * factor);
    }

    /// <summary>Adds pre-tax money (401(k) contributions and the employer match).</summary>
    public void AddRetirement(decimal amount) => Retirement += amount;

    /// <summary>Adds after-tax money to the Roth IRA.</summary>
    public void AddRoth(decimal amount) => Roth += amount;

    /// <summary>Adds after-tax money to the taxable account.</summary>
    public void AddTaxable(decimal amount)
    {
        Taxable += amount;
        TaxableBasis += amount;
    }

    /// <summary>
    /// What everything would be worth after the tax owed on it: income tax on the pre-tax money, capital
    /// gains tax on the taxable growth, nothing on the Roth.
    /// </summary>
    /// <param name="household">The tax rates.</param>
    public decimal AfterTaxValue(Household household)
    {
        var gains = Math.Max(0m, Taxable - TaxableBasis);
        return Money.Round(Retirement * household.AfterTaxShare)
            + Roth
            + Taxable - Money.Round(gains * household.CapitalGainsTaxRate / 100m);
    }
}
