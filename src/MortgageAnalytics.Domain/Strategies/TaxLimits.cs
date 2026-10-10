namespace MortgageAnalytics.Domain.Strategies;

/// <summary>Yearly limits on tax-advantaged savings, for 2026 (IRS Notice 2025-67 and Internal Revenue Code §423).</summary>
public static class TaxLimits
{
    /// <summary>The most an employee can defer into a 401(k) in a year, before catch-up contributions.</summary>
    public const decimal EmployeeDeferral = 24_500m;

    /// <summary>The most anyone under 50 can put into IRAs (Roth and traditional combined) in a year.</summary>
    public const decimal IraContribution = 7_500m;

    /// <summary>The most stock, at market value, an employee stock purchase plan can buy for one person in a year.</summary>
    public const decimal EsppPurchases = 25_000m;
}
