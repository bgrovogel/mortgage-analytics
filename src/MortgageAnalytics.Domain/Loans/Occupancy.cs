namespace MortgageAnalytics.Domain.Loans;

/// <summary>How the buyer will use the home, which decides what loans it can have.</summary>
public enum Occupancy
{
    /// <summary>The home the buyer lives in for most of the year.</summary>
    PrimaryResidence = 0,

    /// <summary>A home the buyer lives in part of the year, and does not rent out.</summary>
    SecondHome = 1,

    /// <summary>A home the buyer does not live in: to rent out, or hold.</summary>
    InvestmentProperty = 2,
}

/// <summary>
/// What a home's use allows. A conventional loan's most is Fannie Mae's Eligibility Matrix for a one-unit purchase:
/// 97% of the price for a principal residence with a fixed rate (above 95%, at least one borrower must be a
/// first-time homebuyer, which is not asked here) or 95% with an adjustable one, 90% for a second home and 85% for an
/// investment property. FHA and VA are only for a home the borrower lives in: HUD insures a principal residence
/// (Handbook 4000.1), and VA asks the veteran to certify they will live there (38 U.S.C. 3704(c)). Texas's homestead
/// exemptions are only for the owner's principal residence (Tax Code 11.13(j)).
/// </summary>
public static class OccupancyRules
{
    /// <summary>The most a conventional loan may be, as a percentage of the price.</summary>
    /// <param name="occupancy">How the home will be used.</param>
    /// <param name="adjustableRate">True for an adjustable rate, which a principal residence is held lower for.</param>
    public static decimal MaxConventionalLoanToValuePercent(this Occupancy occupancy, bool adjustableRate) => occupancy switch
    {
        Occupancy.SecondHome => 90m,
        Occupancy.InvestmentProperty => 85m,
        _ => adjustableRate ? 95m : 97m,
    };

    /// <summary>True when FHA and VA loans are allowed: only for a home the borrower lives in.</summary>
    public static bool AllowsGovernmentLoan(this Occupancy occupancy) => occupancy == Occupancy.PrimaryResidence;

    /// <summary>True when a homestead exemption is allowed: only for the owner's principal residence.</summary>
    public static bool AllowsHomestead(this Occupancy occupancy) => occupancy == Occupancy.PrimaryResidence;
}
