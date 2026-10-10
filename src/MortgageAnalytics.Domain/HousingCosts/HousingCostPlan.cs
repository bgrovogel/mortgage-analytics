using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// Every recurring cost of owning the home, applied month by month to an amortization schedule.
/// A composite: callers never need to know which costs are in the plan.
/// </summary>
public sealed class HousingCostPlan
{
    private readonly List<IHousingCost> _costs;

    /// <summary>Creates a plan from the given costs.</summary>
    public HousingCostPlan(IEnumerable<IHousingCost> costs) => _costs = costs.ToList();

    /// <summary>A plan with no costs: principal and interest only.</summary>
    public static HousingCostPlan None { get; } = new([]);

    /// <summary>True when the plan holds no costs.</summary>
    public bool IsEmpty => _costs.Count == 0;

    /// <summary>Calculates every cost for every payment in a schedule that is itself the original schedule (no extra payments).</summary>
    /// <param name="schedule">The amortization schedule the costs are charged alongside.</param>
    public HousingCostSchedule ApplyTo(AmortizationSchedule schedule) => ApplyTo(schedule, schedule);

    /// <summary>Calculates every cost for every payment in <paramref name="schedule"/>.</summary>
    /// <param name="schedule">The amortization schedule the costs are charged alongside.</param>
    /// <param name="originalSchedule">
    /// The loan's original schedule, without extra payments. Some rules depend on it rather than on the
    /// actual balance: automatic PMI termination, for example.
    /// </param>
    /// <returns>One breakdown per payment, aligned with <see cref="AmortizationSchedule.Payments"/>.</returns>
    /// <remarks>
    /// Costs are counted only while the loan is outstanding. Taxes, insurance and dues continue after
    /// payoff, so comparing them between two payoff dates would invent savings that do not exist.
    /// <see cref="LoanComparison"/> therefore counts only interest and PMI as savings.
    /// </remarks>
    public HousingCostSchedule ApplyTo(AmortizationSchedule schedule, AmortizationSchedule originalSchedule)
    {
        var periods = schedule.Payments
            .Select(p => HousingCostBreakdown.For(
                _costs,
                new CostPeriod(p.PaymentNumber, p.OpeningBalance, ScheduledOpeningBalance(originalSchedule, p.PaymentNumber))))
            .ToList();

        return new HousingCostSchedule(schedule, periods);
    }

    /// <summary>The original schedule's opening balance for a payment; zero once that schedule has paid off.</summary>
    private static decimal ScheduledOpeningBalance(AmortizationSchedule originalSchedule, int paymentNumber) =>
        paymentNumber <= originalSchedule.NumberOfPayments ? originalSchedule.Payments[paymentNumber - 1].OpeningBalance : 0m;
}
