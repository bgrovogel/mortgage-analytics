namespace MortgageAnalytics.Domain.Amortization;

/// <summary>
/// When a cost paid up front for a cheaper loan is paid back: the first payment by which the interest saved, month by
/// month, covers it. Interest only, because principal repaid is not a cost; a simple "cost ÷ monthly saving" would
/// overstate the benefit when the terms or balances differ. Used by refinancing and by discount points.
/// </summary>
public static class InterestBreakEven
{
    /// <summary>The payment number by which <paramref name="cheaper"/> has saved <paramref name="cost"/> of interest over <paramref name="dearer"/>, or null when it never does.</summary>
    /// <param name="cost">What was paid up front.</param>
    /// <param name="dearer">The loan without the cost: the one kept, or the one without points.</param>
    /// <param name="cheaper">The loan the cost buys.</param>
    public static int? PaymentNumber(decimal cost, AmortizationSchedule dearer, AmortizationSchedule cheaper)
    {
        // Once a loan is paid off it charges no more interest, so walk the cheaper loan's whole schedule.
        var interestSaved = 0m;
        for (var number = 1; number <= cheaper.NumberOfPayments; number++)
        {
            interestSaved += InterestOf(dearer, number) - InterestOf(cheaper, number);
            if (interestSaved >= cost)
                return number;
        }

        return null;
    }

    private static decimal InterestOf(AmortizationSchedule schedule, int paymentNumber) =>
        paymentNumber <= schedule.NumberOfPayments ? schedule.Payments[paymentNumber - 1].Interest : 0m;
}
