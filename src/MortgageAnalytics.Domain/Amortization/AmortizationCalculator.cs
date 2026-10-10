using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Amortization;

/// <summary>Generates month-by-month schedules for fixed-rate, fully amortizing loans.</summary>
/// <remarks>
/// Each period, in order:
/// <list type="number">
///   <item>Interest = opening balance × monthly rate, rounded to cents.</item>
///   <item>Scheduled principal = payment − interest, capped at the balance. In the final scheduled
///         period the whole balance is due, which absorbs any rounding drift of a few cents.</item>
///   <item>Extra principal is capped at the balance that remains, so a prepayment can never overpay the loan.</item>
///   <item>If the period's largest single prepayment qualifies under the <see cref="RecastPolicy"/>,
///         the payment is re-amortized over the remaining term and a <see cref="RecastEvent"/> is recorded.</item>
/// </list>
/// The class holds no state, so one instance can safely be shared across requests.
/// </remarks>
public sealed class AmortizationCalculator : IAmortizationCalculator
{
    /// <inheritdoc />
    public AmortizationSchedule Generate(LoanTerms loan, ExtraPaymentPlan extraPayments, RecastPolicy recastPolicy)
    {
        var monthlyRate = loan.MonthlyRate;
        var initialPayment = PaymentFormula.MonthlyPayment(loan.Principal, monthlyRate, loan.TermInMonths);
        var payment = initialPayment;
        var balance = loan.Principal;
        var rows = new List<ScheduledPayment>(loan.TermInMonths);
        var recasts = new List<RecastEvent>();

        for (var period = 1; period <= loan.TermInMonths && balance > 0; period++)
        {
            var interest = Money.Round(balance * monthlyRate);
            var isFinalPeriod = period == loan.TermInMonths;
            var principal = isFinalPeriod ? balance : Math.Min(payment - interest, balance);
            balance -= principal;

            var extra = Math.Min(extraPayments.AmountFor(period), balance);
            balance -= extra;

            rows.Add(new ScheduledPayment(period, loan.DueDateOf(period), interest, principal, extra, balance));

            // A recast follows one qualifying payment, so compare the largest single prepayment, not the total.
            if (balance > 0 && recastPolicy.ShouldRecastAfter(extraPayments.LargestSinglePaymentFor(period)))
            {
                var recastPayment = PaymentFormula.MonthlyPayment(balance, monthlyRate, loan.TermInMonths - period);
                recasts.Add(new RecastEvent(period, payment, recastPayment, recastPolicy.Fee));
                payment = recastPayment;
            }
        }

        return new AmortizationSchedule(initialPayment, rows, recasts);
    }
}
