using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// PMI on a loan, as a borrower sees it on a statement: a monthly premium that stops once the balance falls to
/// <see cref="RemovalBalance"/> (80% of the home's value, on request) and, under the Homeowners Protection Act, after
/// <see cref="LastPayment"/> (the loan's midpoint) whatever the balance. Used where only a loan and a home value are
/// known: a refinance's two loans and the loan in pay off or invest. The purchase calculator's
/// <see cref="MortgageInsurance"/> also follows the original schedule, for automatic removal.
/// </summary>
public sealed record LoanPmi
{
    /// <summary>The loan-to-value, as a fraction, above which a new loan needs PMI and at which it can be removed.</summary>
    public const decimal RemovalLoanToValue = 0.80m;

    /// <summary>No PMI.</summary>
    public static LoanPmi None { get; } = new(0m, 0m, 0);

    private LoanPmi(decimal monthlyPremium, decimal removalBalance, int lastPayment)
    {
        if (monthlyPremium < 0)
            throw new DomainValidationException("PMI cannot be negative.");

        MonthlyPremium = monthlyPremium;
        RemovalBalance = removalBalance;
        LastPayment = lastPayment;
    }

    /// <summary>The charge each month while PMI is in force.</summary>
    public decimal MonthlyPremium { get; }

    /// <summary>The balance at or below which PMI is no longer charged: 80% of the home's value.</summary>
    public decimal RemovalBalance { get; }

    /// <summary>The last payment PMI can be charged with: the loan's midpoint, or <see cref="int.MaxValue"/> when not known.</summary>
    public int LastPayment { get; }

    /// <summary>
    /// PMI on a new loan: required only above 80% of the home's value, at <paramref name="annualRatePercent"/> of the
    /// loan a year, until the actual balance reaches 80% of that value (on request) or the loan's midpoint.
    /// </summary>
    /// <param name="loanAmount">The new loan.</param>
    /// <param name="homeValue">The home's value (its appraisal); zero when not known, which means no PMI.</param>
    /// <param name="annualRatePercent">The yearly premium as a percentage of the loan (0.5 means 0.5%).</param>
    /// <param name="termInMonths">The new loan's term, whose midpoint ends PMI at the latest.</param>
    /// <exception cref="DomainValidationException">The rate is negative.</exception>
    public static LoanPmi ForNewLoan(decimal loanAmount, decimal homeValue, decimal annualRatePercent, int termInMonths)
    {
        if (annualRatePercent < 0)
            throw new DomainValidationException("A PMI rate cannot be negative.");

        var removal = homeValue * RemovalLoanToValue;
        return homeValue > 0 && loanAmount > removal && annualRatePercent > 0
            ? new LoanPmi(Money.Round(loanAmount * annualRatePercent / 100m / 12m), removal, (termInMonths + 1) / 2)
            : None;
    }

    /// <summary>
    /// PMI already on a loan: the premium paid now, until the balance reaches 80% of the home's value today, when the
    /// borrower can ask for it to go. The loan's midpoint is not known from what is owed today, so it is not applied.
    /// </summary>
    /// <param name="monthlyPremium">The PMI on the latest statement; zero for none.</param>
    /// <param name="homeValue">What the home is worth today.</param>
    /// <exception cref="DomainValidationException">The premium is negative.</exception>
    public static LoanPmi OnCurrentLoan(decimal monthlyPremium, decimal homeValue) =>
        monthlyPremium == 0 ? None : new LoanPmi(monthlyPremium, homeValue * RemovalLoanToValue, int.MaxValue);

    /// <summary>The PMI with payment <paramref name="paymentNumber"/>, whose opening balance is <paramref name="openingBalance"/>.</summary>
    /// <param name="paymentNumber">The 1-based payment number on this loan.</param>
    /// <param name="openingBalance">The actual balance before the payment.</param>
    public decimal For(int paymentNumber, decimal openingBalance) =>
        paymentNumber <= LastPayment && openingBalance > RemovalBalance ? MonthlyPremium : 0m;

    /// <summary>The PMI with each payment of <paramref name="schedule"/>, in order.</summary>
    public IEnumerable<decimal> ChargesOn(AmortizationSchedule schedule) =>
        schedule.Payments.Select(p => For(p.PaymentNumber, p.OpeningBalance));

    /// <summary>The PMI with the first payment of <paramref name="schedule"/>.</summary>
    public decimal FirstOn(AmortizationSchedule schedule) => For(1, schedule.Payments[0].OpeningBalance);

    /// <summary>All the PMI paid over <paramref name="schedule"/>.</summary>
    public decimal TotalOn(AmortizationSchedule schedule) => ChargesOn(schedule).Sum();

    /// <summary>The last payment of <paramref name="schedule"/> with PMI, or null when none has any.</summary>
    public int? LastPaymentOn(AmortizationSchedule schedule) =>
        schedule.Payments.LastOrDefault(p => For(p.PaymentNumber, p.OpeningBalance) > 0)?.PaymentNumber;
}
