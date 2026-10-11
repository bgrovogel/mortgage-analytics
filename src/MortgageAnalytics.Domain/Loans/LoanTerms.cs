namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// The immutable terms of a fixed-rate, fully amortizing loan.
/// Guard clauses make it impossible to construct an invalid loan.
/// </summary>
public sealed record LoanTerms
{
    /// <summary>The largest loan amount accepted, in dollars.</summary>
    public const decimal MaxPrincipal = 100_000_000m;

    /// <summary>The highest annual interest rate accepted, as a percentage.</summary>
    public const decimal MaxAnnualInterestRate = 30m;

    /// <summary>The longest term accepted, in months (50 years).</summary>
    public const int MaxTermInMonths = 600;

    /// <summary>Creates loan terms, rejecting any value outside the supported range.</summary>
    /// <param name="principal">The amount borrowed, in dollars.</param>
    /// <param name="annualInterestRate">The nominal annual rate as a percentage (6.5 means 6.5%).</param>
    /// <param name="termInMonths">The number of monthly payments.</param>
    /// <param name="firstPaymentDate">The due date of the first payment.</param>
    /// <exception cref="DomainValidationException">A value is out of range.</exception>
    public LoanTerms(decimal principal, decimal annualInterestRate, int termInMonths, DateOnly firstPaymentDate)
    {
        if (principal is <= 0 or > MaxPrincipal)
            throw new DomainValidationException($"Principal must be greater than 0 and at most {MaxPrincipal:N0}.");
        if (annualInterestRate is < 0 or > MaxAnnualInterestRate)
            throw new DomainValidationException($"Annual interest rate must be between 0 and {MaxAnnualInterestRate}%.");
        if (termInMonths is <= 0 or > MaxTermInMonths)
            throw new DomainValidationException($"Term must be between 1 and {MaxTermInMonths} months.");

        Principal = principal;
        AnnualInterestRate = annualInterestRate;
        TermInMonths = termInMonths;
        FirstPaymentDate = firstPaymentDate;
    }

    /// <summary>The amount borrowed, in dollars.</summary>
    public decimal Principal { get; }

    /// <summary>The nominal annual rate as a percentage (6.5 means 6.5%).</summary>
    public decimal AnnualInterestRate { get; }

    /// <summary>The number of monthly payments.</summary>
    public int TermInMonths { get; }

    /// <summary>The due date of the first payment.</summary>
    public DateOnly FirstPaymentDate { get; }

    /// <summary>
    /// Rate changes after the first payment, in order (an adjustable-rate loan). Empty for a fixed rate, where
    /// <see cref="AnnualInterestRate"/> applies throughout.
    /// </summary>
    public IReadOnlyList<RateChange> RateChanges { get; private init; } = [];

    /// <summary>The same loan with its rate changing as given.</summary>
    /// <param name="changes">Each change's first payment (after the first, within the term, in increasing order) and rate.</param>
    /// <returns>A copy of these terms with the rate changes.</returns>
    /// <exception cref="DomainValidationException">A change is out of order, outside the term, or its rate out of range.</exception>
    public LoanTerms WithRateChanges(IReadOnlyList<RateChange> changes)
    {
        var previous = 1;
        foreach (var change in changes)
        {
            if (change.FromPaymentNumber <= previous || change.FromPaymentNumber > TermInMonths)
                throw new DomainValidationException("Rate changes must fall after the first payment and within the term, in order.");
            if (change.AnnualInterestRate is < 0 or > MaxAnnualInterestRate)
                throw new DomainValidationException($"A changed rate must be between 0 and {MaxAnnualInterestRate}%.");
            previous = change.FromPaymentNumber;
        }

        return this with { RateChanges = changes };
    }

    /// <summary>The annual rate charged on payment <paramref name="paymentNumber"/>, as a percentage.</summary>
    /// <param name="paymentNumber">A 1-based payment number.</param>
    public decimal AnnualRateFor(int paymentNumber)
    {
        var rate = AnnualInterestRate;
        foreach (var change in RateChanges)
        {
            if (change.FromPaymentNumber > paymentNumber) break;
            rate = change.AnnualInterestRate;
        }

        return rate;
    }

    /// <summary>The periodic (monthly) rate as a fraction. 6.5% becomes 0.065 ÷ 12.</summary>
    public decimal MonthlyRate => AnnualInterestRate / 100m / 12m;

    /// <summary>One month's interest on <paramref name="balance"/>, rounded to cents.</summary>
    /// <remarks>
    /// Multiplies before dividing. A monthly rate like 7% ÷ 12 repeats forever, so multiplying by a
    /// pre-divided <see cref="MonthlyRate"/> can land a hair under an exact half cent and round the wrong way.
    /// </remarks>
    /// <param name="balance">The balance the interest accrues on.</param>
    public decimal MonthlyInterestOn(decimal balance) => MonthlyInterestOn(balance, AnnualInterestRate);

    /// <summary>One month's interest on <paramref name="balance"/> at <paramref name="annualRate"/> percent, rounded to cents.</summary>
    /// <param name="balance">The balance the interest accrues on.</param>
    /// <param name="annualRate">The annual rate, as a percentage.</param>
    public static decimal MonthlyInterestOn(decimal balance, decimal annualRate) => Money.Round(balance * annualRate / 1_200m);

    /// <summary>Returns the due date of payment <paramref name="paymentNumber"/>, one month apart from the first.</summary>
    /// <remarks>A first payment on the 31st falls on the last day of shorter months.</remarks>
    public DateOnly DueDateOf(int paymentNumber) => FirstPaymentDate.AddMonths(paymentNumber - 1);
}
