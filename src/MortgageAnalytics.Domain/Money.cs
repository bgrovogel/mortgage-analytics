namespace MortgageAnalytics.Domain;

/// <summary>
/// The single place where monetary rounding policy lives.
/// Every currency amount the engine emits passes through <see cref="Round"/>, so the
/// rounding rule can be changed (or audited) in exactly one spot.
/// </summary>
public static class Money
{
    /// <summary>Rounds to whole cents, half away from zero (the convention US lenders use).</summary>
    public static decimal Round(decimal amount) => Math.Round(amount, 2, MidpointRounding.AwayFromZero);
}
