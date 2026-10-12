using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// A temporary buydown (a 2-1 or 3-2-1): for the first years, the borrower pays as if the rate were lower, and
/// the difference (the subsidy, usually paid up front by the seller or builder) covers the rest. The loan itself is
/// at the note rate throughout: it amortizes, and charges interest, exactly as without the buydown.
/// </summary>
/// <remarks>
/// Each year's payment is the standard payment on the original amount, over the full term, at the reduced rate,
/// which is how buydown subsidies are figured. A 2-1 buydown on a 5.99% loan pays as if at 3.99% in year 1 and
/// 4.99% in year 2: <c>new TemporaryBuydown([2, 1])</c>.
/// </remarks>
public sealed record TemporaryBuydown
{
    /// <summary>The most years a buydown can cover.</summary>
    public const int MaxYears = 3;

    /// <summary>The largest reduction in any year, in points.</summary>
    public const decimal MaxReduction = 3m;

    /// <summary>Creates a buydown from its yearly reductions.</summary>
    /// <param name="yearlyReductions">How many points below the note rate each year is paid at, year 1 first.</param>
    /// <exception cref="DomainValidationException">There are no years, too many, or a reduction is out of range.</exception>
    public TemporaryBuydown(IReadOnlyList<decimal> yearlyReductions)
    {
        if (yearlyReductions.Count is 0 or > MaxYears)
            throw new DomainValidationException($"A buydown covers 1 to {MaxYears} years.");
        if (yearlyReductions.Any(r => r is <= 0 or > MaxReduction))
            throw new DomainValidationException($"Each year's reduction must be more than 0 and at most {MaxReduction} points.");

        YearlyReductions = yearlyReductions;
    }

    /// <summary>The points below the note rate each year is paid at, year 1 first.</summary>
    public IReadOnlyList<decimal> YearlyReductions { get; }

    /// <summary>The rate year <paramref name="year"/> is paid at: the note rate less that year's reduction (never below 0%).</summary>
    /// <param name="loan">The loan, at its note rate.</param>
    /// <param name="year">A 1-based year of the loan.</param>
    public decimal RateForYear(LoanTerms loan, int year) =>
        year <= YearlyReductions.Count ? Math.Max(0m, loan.AnnualInterestRate - YearlyReductions[year - 1]) : loan.AnnualInterestRate;

    /// <summary>The payment the borrower makes in year <paramref name="year"/>: the standard payment at that year's rate.</summary>
    /// <param name="loan">The loan, at its note rate.</param>
    /// <param name="year">A 1-based year of the loan.</param>
    public decimal PaymentForYear(LoanTerms loan, int year) =>
        PaymentFormula.MonthlyPayment(loan.Principal, RateForYear(loan, year) / 100m / 12m, loan.TermInMonths);

    /// <summary>
    /// What the subsidy covers of payment <paramref name="paymentNumber"/>: the note-rate payment less the year's
    /// reduced payment, and never more than the payment itself (a final payment can be small). 0 after the buydown years.
    /// </summary>
    /// <param name="loan">The loan, at its note rate.</param>
    /// <param name="paymentNumber">A 1-based payment number.</param>
    /// <param name="scheduledAmount">That payment's principal and interest, from the schedule.</param>
    public decimal SubsidyFor(LoanTerms loan, int paymentNumber, decimal scheduledAmount)
    {
        var year = (paymentNumber - 1) / 12 + 1;
        if (year > YearlyReductions.Count) return 0m;
        var gap = PaymentFormula.MonthlyPayment(loan.Principal, loan.MonthlyRate, loan.TermInMonths) - PaymentForYear(loan, year);
        return Math.Min(gap, scheduledAmount);
    }

    /// <summary>
    /// The whole subsidy over <paramref name="schedule"/>: every bought-down payment's gap. A loan paid off during the
    /// buydown years needs less.
    /// </summary>
    /// <param name="loan">The loan, at its note rate.</param>
    /// <param name="schedule">The loan's schedule, with or without extra payments.</param>
    public decimal TotalSubsidy(LoanTerms loan, AmortizationSchedule schedule) =>
        schedule.Payments.Sum(p => SubsidyFor(loan, p.PaymentNumber, p.ScheduledAmount));

    /// <summary>
    /// The interest the borrower pays. The loan charges its note-rate interest either way, and the principal paid does
    /// not change, so a subsidy from the seller or builder pays interest: the borrower pays that much less. A subsidy
    /// the borrower paid for at closing is their own money, so they pay all of the interest.
    /// </summary>
    /// <param name="loan">The loan, at its note rate.</param>
    /// <param name="schedule">The loan's schedule, with or without extra payments.</param>
    /// <param name="paidBy">Who paid for the buydown.</param>
    public decimal InterestYouPay(LoanTerms loan, AmortizationSchedule schedule, BuydownPayer paidBy) =>
        schedule.TotalInterest - (paidBy == BuydownPayer.Seller ? TotalSubsidy(loan, schedule) : 0m);
}
