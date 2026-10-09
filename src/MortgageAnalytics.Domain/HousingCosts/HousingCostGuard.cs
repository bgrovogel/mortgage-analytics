namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>Shared guard clauses for housing-cost constructors.</summary>
internal static class HousingCostGuard
{
    /// <summary>Throws when <paramref name="value"/> is below zero.</summary>
    public static void AgainstNegative(decimal value, string name)
    {
        if (value < 0)
            throw new DomainValidationException($"{name} cannot be negative.");
    }

    /// <summary>Throws when an annual change is -100% or less, which would wipe the amount out or flip its sign.</summary>
    public static void AgainstInvalidGrowth(decimal annualPercent)
    {
        if (annualPercent <= -100)
            throw new DomainValidationException("An annual increase must be greater than -100%.");
    }
}
