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
}
