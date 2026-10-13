using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Domain.Amortization;

/// <summary>
/// When a cost paid up front for a cheaper loan is paid back: the first payment by which the interest saved, month by
/// month, covers it. Interest only, because principal repaid is not a cost; a simple "cost ÷ monthly saving" would
/// overstate the benefit when the terms or balances differ. PMI on either loan counts like interest: it is a cost too.
/// Used by refinancing and by discount points.
/// </summary>
public static class InterestBreakEven
{
    /// <summary>The payment number by which <paramref name="cheaper"/> has saved <paramref name="cost"/> of interest over <paramref name="dearer"/>, or null when it never does.</summary>
    /// <param name="cost">What was paid up front.</param>
    /// <param name="dearer">The loan without the cost: the one kept, or the one without points.</param>
    /// <param name="cheaper">The loan the cost buys.</param>
    /// <param name="dearerPmi">PMI on the dearer loan; null for none.</param>
    /// <param name="cheaperPmi">PMI on the cheaper loan; null for none.</param>
    public static int? PaymentNumber(
        decimal cost, AmortizationSchedule dearer, AmortizationSchedule cheaper, LoanPmi? dearerPmi = null, LoanPmi? cheaperPmi = null)
    {
        // Once a loan is paid off it charges no more interest, so walk the cheaper loan's whole schedule.
        var interestSaved = 0m;
        for (var number = 1; number <= cheaper.NumberOfPayments; number++)
        {
            interestSaved += CostOf(dearer, dearerPmi, number) - CostOf(cheaper, cheaperPmi, number);
            if (interestSaved >= cost)
                return number;
        }

        return null;
    }

    private static decimal CostOf(AmortizationSchedule schedule, LoanPmi? pmi, int paymentNumber)
    {
        if (paymentNumber > schedule.NumberOfPayments)
            return 0m;

        var payment = schedule.Payments[paymentNumber - 1];
        return payment.Interest + (pmi?.For(paymentNumber, payment.OpeningBalance) ?? 0m);
    }
}
