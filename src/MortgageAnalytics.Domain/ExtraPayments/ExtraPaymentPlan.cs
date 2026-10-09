namespace MortgageAnalytics.Domain.ExtraPayments;

/// <summary>
/// Every prepayment rule for a loan, combined. The calculator asks the plan for one total per
/// payment, so it never needs to know how many rules exist or what kind they are (Composite).
/// </summary>
public sealed class ExtraPaymentPlan
{
    private readonly List<IExtraPaymentRule> _rules;

    /// <summary>Creates a plan from the given rules.</summary>
    public ExtraPaymentPlan(IEnumerable<IExtraPaymentRule> rules) => _rules = rules.ToList();

    /// <summary>A plan with no prepayments.</summary>
    public static ExtraPaymentPlan None { get; } = new([]);

    /// <summary>True when the plan holds no rules.</summary>
    public bool IsEmpty => _rules.Count == 0;

    /// <summary>Returns the total extra principal for payment <paramref name="paymentNumber"/> across all rules, rounded to cents.</summary>
    public decimal AmountFor(int paymentNumber) => Money.Round(_rules.Sum(rule => rule.AmountFor(paymentNumber)));
}
