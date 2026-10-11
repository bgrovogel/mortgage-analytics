using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;

namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// Where a loan stands on a given day, from its own schedule: the payments made, and the loan that is left. A
/// refinance described by its original loan (amount, rate, term, first payment) starts from this, so its balance
/// matches the purchase calculator's schedule to the cent.
/// </summary>
public static class LoanProgress
{
    /// <summary>The payments made before <paramref name="today"/>: every due date before it. One due today is not made yet.</summary>
    /// <param name="loan">The original loan.</param>
    /// <param name="today">The day to count to.</param>
    /// <returns>Between 0 and the loan's term.</returns>
    public static int PaymentsMadeBefore(this LoanTerms loan, DateOnly today)
    {
        var made = 0;
        while (made < loan.TermInMonths && loan.DueDateOf(made + 1) < today) made++;
        return made;
    }

    /// <summary>
    /// The rest of <paramref name="original"/> as of <paramref name="today"/>, paid as scheduled: what is owed after
    /// the payments made, at the same rate, over the payments left, starting with the next due date.
    /// </summary>
    /// <param name="calculator">Builds the original loan's schedule.</param>
    /// <param name="original">The loan as it was taken out.</param>
    /// <param name="today">The day the loan stands on.</param>
    /// <returns>The loan still to pay; the original itself when no payment has been made yet.</returns>
    /// <exception cref="DomainValidationException">Every payment is already behind <paramref name="today"/>.</exception>
    public static LoanTerms RemainingAsOf(this IAmortizationCalculator calculator, LoanTerms original, DateOnly today)
    {
        var made = original.PaymentsMadeBefore(today);
        if (made == 0) return original;
        if (made == original.TermInMonths)
            throw new DomainValidationException("The loan is already paid off: every payment is behind that date.");

        var owed = calculator.Generate(original, ExtraPaymentPlan.None, RecastPolicy.Never).Payments[made - 1].RemainingBalance;
        // An adjustable rate carries on: today's rate, and the changes still ahead, renumbered from the next payment.
        var ahead = original.RateChanges
            .Where(c => c.FromPaymentNumber > made + 1)
            .Select(c => c with { FromPaymentNumber = c.FromPaymentNumber - made })
            .ToList();
        return new LoanTerms(owed, original.AnnualRateFor(made + 1), original.TermInMonths - made, original.DueDateOf(made + 1))
            .WithRateChanges(ahead);
    }
}
