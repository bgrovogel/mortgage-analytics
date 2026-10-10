namespace MortgageAnalytics.Domain.Strategies;

/// <summary>
/// An employee stock purchase plan: payroll savings buy company stock at a discount at the end of each
/// purchase period. The shares are sold as soon as they are bought, so the discount is a near-certain
/// gain (taxed as income), not a bet on the company.
/// </summary>
public sealed record StockPurchasePlan
{
    /// <summary>Creates a plan, rejecting any value outside what Internal Revenue Code §423 allows.</summary>
    /// <param name="contributionPercentOfPay">The share of pay set aside, as a percentage.</param>
    /// <param name="discountPercent">The discount on the purchase price, as a percentage (at most 15).</param>
    /// <param name="purchasePeriodMonths">Months between purchases: how long the money is held before it comes back.</param>
    /// <exception cref="DomainValidationException">A value is out of range.</exception>
    public StockPurchasePlan(decimal contributionPercentOfPay, decimal discountPercent, int purchasePeriodMonths)
    {
        if (contributionPercentOfPay is < 0 or > 25)
            throw new DomainValidationException("ESPP contributions must be between 0% and 25% of pay.");
        if (discountPercent is < 0 or > 15)
            throw new DomainValidationException("An ESPP discount must be between 0% and 15%.");
        if (purchasePeriodMonths is < 1 or > 27)
            throw new DomainValidationException("An ESPP purchase period must be between 1 and 27 months.");

        ContributionPercentOfPay = contributionPercentOfPay;
        DiscountPercent = discountPercent;
        PurchasePeriodMonths = purchasePeriodMonths;
    }

    /// <summary>No ESPP.</summary>
    public static StockPurchasePlan None { get; } = new(0m, 0m, 6);

    /// <summary>The share of pay set aside, as a percentage.</summary>
    public decimal ContributionPercentOfPay { get; }

    /// <summary>The discount on the purchase price, as a percentage.</summary>
    public decimal DiscountPercent { get; }

    /// <summary>Months between purchases.</summary>
    public int PurchasePeriodMonths { get; }

    /// <summary>True when money goes into the plan.</summary>
    public bool Exists => ContributionPercentOfPay > 0;

    /// <summary>The gain on each purchase before tax, as a percentage of the money put in: a 15% discount turns $85 into $100, a 17.65% gain.</summary>
    public decimal GainPercent => Math.Round(DiscountPercent * 100m / (100m - DiscountPercent), 2, MidpointRounding.AwayFromZero);

    /// <summary>What the shares bought with <paramref name="saved"/> sell for, before tax: saved ÷ (1 − discount).</summary>
    /// <param name="saved">The money contributed during one purchase period.</param>
    public decimal SaleProceeds(decimal saved) => Money.Round(saved * 100m / (100m - DiscountPercent));
}
