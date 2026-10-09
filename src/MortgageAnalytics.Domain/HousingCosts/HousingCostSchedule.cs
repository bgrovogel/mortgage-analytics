using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>Housing costs for each payment of a schedule, plus lifetime totals.</summary>
public sealed class HousingCostSchedule
{
    /// <summary>Wraps per-payment breakdowns that line up one-to-one with <paramref name="schedule"/>'s payments.</summary>
    /// <exception cref="DomainValidationException">The number of breakdowns does not match the number of payments.</exception>
    public HousingCostSchedule(AmortizationSchedule schedule, IReadOnlyList<HousingCostBreakdown> periods)
    {
        if (periods.Count != schedule.NumberOfPayments)
            throw new DomainValidationException("There must be exactly one cost breakdown per payment.");

        Periods = periods;
        Totals = HousingCostBreakdown.Sum(periods);
        ByYear = periods
            .Chunk(12)
            .Select(HousingCostBreakdown.Sum)
            .ToList();
        MortgageInsuranceLastPayment = schedule.Payments
            .Where((_, i) => periods[i][HousingCostCategory.MortgageInsurance] > 0)
            .Select(p => p.PaymentNumber)
            .Cast<int?>()
            .LastOrDefault();
    }

    /// <summary>The costs for each payment; index <c>i</c> belongs to payment <c>i + 1</c>.</summary>
    public IReadOnlyList<HousingCostBreakdown> Periods { get; }

    /// <summary>Each category summed per loan year; index <c>y</c> covers payments <c>12y + 1</c> to <c>12y + 12</c>.</summary>
    public IReadOnlyList<HousingCostBreakdown> ByYear { get; }

    /// <summary>Each category summed over the life of the loan.</summary>
    public HousingCostBreakdown Totals { get; }

    /// <summary>The last payment number that included PMI, or null if PMI was never charged.</summary>
    public int? MortgageInsuranceLastPayment { get; }
}
