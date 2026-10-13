namespace MortgageAnalytics.Application.Contracts;

/// <summary>
/// The loan you have today, and the refinance offer to compare it with. The loan today is either what is owed
/// now (<see cref="CurrentBalance"/>, <see cref="RemainingTermInMonths"/>) or the loan as it was taken out
/// (<see cref="OriginalLoan"/>), from which the server works out what is owed now.
/// </summary>
public sealed record RefinanceRequest
{
    /// <summary>The balance still owed on the current loan. Ignored when <see cref="OriginalLoan"/> is given.</summary>
    /// <example>300000</example>
    public decimal CurrentBalance { get; init; }

    /// <summary>The current loan's annual interest rate, as a percentage.</summary>
    /// <example>7</example>
    public decimal CurrentAnnualInterestRate { get; init; }

    /// <summary>How many monthly payments are left on the current loan. Ignored when <see cref="OriginalLoan"/> is given.</summary>
    /// <example>300</example>
    public int RemainingTermInMonths { get; init; }

    /// <summary>
    /// The current loan as it was taken out, at <see cref="CurrentAnnualInterestRate"/>. When given, what is owed
    /// now, the payments left and the next due date all come from this loan's own schedule as of today, exactly as
    /// the purchase calculator would show them.
    /// </summary>
    public OriginalLoanRequest? OriginalLoan { get; init; }

    /// <summary>When the next payment is due, on either loan. Defaults to the first day of next month. Ignored when <see cref="OriginalLoan"/> is given.</summary>
    /// <example>2026-11-01</example>
    public DateOnly? NextPaymentDate { get; init; }

    /// <summary>The new loan's annual interest rate, as a percentage.</summary>
    /// <example>6</example>
    public decimal NewAnnualInterestRate { get; init; }

    /// <summary>The new loan's term in months. Use <see cref="RemainingTermInMonths"/> to keep today's payoff date.</summary>
    /// <example>360</example>
    public int NewTermInMonths { get; init; }

    /// <summary>Fees, points and other costs to close the new loan.</summary>
    /// <example>6000</example>
    public decimal ClosingCosts { get; init; }

    /// <summary>True to add the closing costs to the new loan instead of paying them at closing.</summary>
    /// <example>false</example>
    public bool FinanceClosingCosts { get; init; }

    /// <summary>
    /// The current loan's rate adjusts. Its fixed period counts payments from the next one (or, with
    /// <see cref="OriginalLoan"/>, from the original first payment, and <see cref="CurrentAnnualInterestRate"/> is then
    /// its starting rate). Omit for a fixed rate.
    /// </summary>
    public AdjustableRateRequest? CurrentAdjustableRate { get; init; }

    /// <summary>The new loan's rate adjusts: <see cref="NewAnnualInterestRate"/> is its starting rate. Omit for a fixed rate.</summary>
    public AdjustableRateRequest? NewAdjustableRate { get; init; }

    /// <summary>A temporary buydown on the new loan, paid for in cash at closing. Omit for none.</summary>
    public TemporaryBuydownRequest? NewBuydown { get; init; }

    /// <summary>
    /// What the home is worth today, the new loan's appraisal. With it, each loan carries PMI while it is above 80% of
    /// this value; without it, PMI is left out of the comparison.
    /// </summary>
    /// <example>360000</example>
    public decimal? HomeValue { get; init; }

    /// <summary>The PMI on the current loan's statement each month; 0 for none. Needs <see cref="HomeValue"/>.</summary>
    /// <example>120</example>
    public decimal CurrentMonthlyPmi { get; init; }

    /// <summary>The new loan's yearly PMI rate, as a percentage of the loan, should it be above 80% of the value.</summary>
    /// <example>0.5</example>
    public decimal NewPmiRate { get; init; } = 0.5m;
}

/// <summary>A loan as it was taken out.</summary>
public sealed record OriginalLoanRequest
{
    /// <summary>The amount first borrowed.</summary>
    /// <example>200000</example>
    public decimal Amount { get; init; }

    /// <summary>The original term, in months.</summary>
    /// <example>360</example>
    public int TermInMonths { get; init; }

    /// <summary>When the first payment was due.</summary>
    /// <example>2021-11-01</example>
    public DateOnly FirstPaymentDate { get; init; }
}

/// <summary>Keeping the current loan compared with refinancing it, and what the refinance really saves or costs.</summary>
/// <param name="Current">The rest of the current loan.</param>
/// <param name="Refinanced">The new loan, paid as scheduled.</param>
/// <param name="KeepingCurrentPayment">The new loan while still paying today's payment, or null when the new payment is not lower.</param>
/// <param name="UpfrontCosts">Cash due at closing: the closing costs unless they are financed.</param>
/// <param name="MonthlySavings">How much lower the new payment is, PMI included. Negative when it is higher.</param>
/// <param name="InterestSaved">Interest left on the current loan minus interest on the new one. Negative when the new loan charges more.</param>
/// <param name="LifetimeSavings">Everything left to pay now, PMI included, minus everything the refinance costs, closing costs and PMI included. Negative when refinancing costs more.</param>
/// <param name="KeepingCurrentPaymentLifetimeSavings">The same, when today's payment is kept up on the new loan; null when that option does not apply.</param>
/// <param name="MonthsAdded">How many more payments the new loan takes than the current one has left: the amortization clock restarting.</param>
/// <param name="BreakEvenPaymentNumber">The payment by which the interest and PMI saved first cover the closing costs, or null when they never do.</param>
/// <param name="BreakEvenDate">The due date of that payment, or null.</param>
/// <param name="BuydownCost">What a buydown on the new loan costs at closing (included in <paramref name="UpfrontCosts"/>); it comes back as lower payments.</param>
/// <param name="NewBuydown">The new loan's buydown years and payments, or null without one.</param>
/// <param name="WorstCaseLifetimeSavings">When either loan adjusts: the lifetime savings if rates rise as far as the caps allow. Null when neither does.</param>
public sealed record RefinanceResponse(
    RefinanceOptionResponse Current,
    RefinanceOptionResponse Refinanced,
    RefinanceOptionResponse? KeepingCurrentPayment,
    decimal UpfrontCosts,
    decimal MonthlySavings,
    decimal InterestSaved,
    decimal LifetimeSavings,
    decimal? KeepingCurrentPaymentLifetimeSavings,
    int MonthsAdded,
    int? BreakEvenPaymentNumber,
    DateOnly? BreakEvenDate,
    decimal BuydownCost,
    BuydownResponse? NewBuydown,
    decimal? WorstCaseLifetimeSavings);

/// <summary>One way of repaying: its loan, payment and totals, and (optionally) every payment.</summary>
/// <param name="LoanAmount">The amount being repaid.</param>
/// <param name="MonthlyPayment">The scheduled principal-and-interest payment.</param>
/// <param name="ExtraMonthlyPrincipal">Extra principal paid each month on top of it (zero except when keeping today's payment).</param>
/// <param name="NumberOfPayments">How many payments it takes.</param>
/// <param name="TotalInterest">All interest paid.</param>
/// <param name="TotalPaid">All principal and interest paid.</param>
/// <param name="PayoffDate">The due date of the last payment.</param>
/// <param name="Payments">Every payment, in order; empty when the request asked for summaries only.</param>
/// <param name="RateChanges">Rate resets along the way (an adjustable rate), with the payment before and after each.</param>
/// <param name="MonthlyPmi">The PMI with the first payment; zero without any.</param>
/// <param name="TotalPmi">All the PMI paid.</param>
/// <param name="PmiEndDate">The due date of the last payment with PMI, or null without any.</param>
public sealed record RefinanceOptionResponse(
    decimal LoanAmount,
    decimal MonthlyPayment,
    decimal ExtraMonthlyPrincipal,
    int NumberOfPayments,
    decimal TotalInterest,
    decimal TotalPaid,
    DateOnly PayoffDate,
    IReadOnlyList<LoanPaymentResponse> Payments,
    IReadOnlyList<RateChangeResponse> RateChanges,
    decimal MonthlyPmi = 0m,
    decimal TotalPmi = 0m,
    DateOnly? PmiEndDate = null);

/// <summary>One payment on a loan, without housing costs.</summary>
/// <param name="PaymentNumber">The 1-based payment number.</param>
/// <param name="DueDate">When it is due.</param>
/// <param name="Principal">Principal repaid by the scheduled payment.</param>
/// <param name="Interest">Interest charged this month.</param>
/// <param name="ExtraPrincipal">Extra principal paid this month.</param>
/// <param name="RemainingBalance">The balance after this payment.</param>
public sealed record LoanPaymentResponse(
    int PaymentNumber,
    DateOnly DueDate,
    decimal Principal,
    decimal Interest,
    decimal ExtraPrincipal,
    decimal RemainingBalance);
