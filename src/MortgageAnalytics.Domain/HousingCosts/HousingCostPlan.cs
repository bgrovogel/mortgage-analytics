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

    /// <summary>Calculates every cost for every payment in <paramref name="schedule"/>.</summary>
    /// <param name="schedule">The amortization schedule the costs are charged alongside.</param>
    /// <returns>One breakdown per payment, aligned with <see cref="AmortizationSchedule.Payments"/>.</returns>
    /// <remarks>
    /// Costs are counted only while the loan is outstanding. Taxes, insurance and dues continue after
    /// payoff, so comparing them between two payoff dates would invent savings that do not exist.
    /// <see cref="LoanComparison"/> therefore counts only interest and PMI as savings.
    /// </remarks>
    public HousingCostSchedule ApplyTo(AmortizationSchedule schedule)
    {
        var periods = schedule.Payments
            .Select(p => HousingCostBreakdown.For(_costs, new CostPeriod(p.PaymentNumber, p.OpeningBalance)))
            .ToList();

        return new HousingCostSchedule(schedule, periods);
    }
}
