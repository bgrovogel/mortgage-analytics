namespace MortgageAnalytics.Application.Contracts;

/// <summary>The loan you have today, and the refinance offer to compare it with.</summary>
public sealed record RefinanceRequest
{
    /// <summary>The balance still owed on the current loan.</summary>
    /// <example>300000</example>
    public decimal CurrentBalance { get; init; }

    /// <summary>The current loan's annual interest rate, as a percentage.</summary>
    /// <example>7</example>
    public decimal CurrentAnnualInterestRate { get; init; }

    /// <summary>How many monthly payments are left on the current loan.</summary>
    /// <example>300</example>
    public int RemainingTermInMonths { get; init; }

    /// <summary>When the next payment is due, on either loan. Defaults to the first day of next month.</summary>
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
}

/// <summary>Keeping the current loan compared with refinancing it, and what the refinance really saves or costs.</summary>
/// <param name="Current">The rest of the current loan.</param>
/// <param name="Refinanced">The new loan, paid as scheduled.</param>
/// <param name="KeepingCurrentPayment">The new loan while still paying today's payment, or null when the new payment is not lower.</param>
/// <param name="UpfrontCosts">Cash due at closing: the closing costs unless they are financed.</param>
/// <param name="MonthlySavings">How much lower the new payment is. Negative when it is higher.</param>
/// <param name="InterestSaved">Interest left on the current loan minus interest on the new one. Negative when the new loan charges more.</param>
/// <param name="LifetimeSavings">Everything left to pay now, minus everything the refinance costs, closing costs included. Negative when refinancing costs more.</param>
/// <param name="KeepingCurrentPaymentLifetimeSavings">The same, when today's payment is kept up on the new loan; null when that option does not apply.</param>
/// <param name="MonthsAdded">How many more payments the new loan takes than the current one has left: the amortization clock restarting.</param>
/// <param name="BreakEvenPaymentNumber">The payment by which the interest saved first covers the closing costs, or null when it never does.</param>
/// <param name="BreakEvenDate">The due date of that payment, or null.</param>
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
    DateOnly? BreakEvenDate);

/// <summary>One way of repaying: its loan, payment and totals, and (optionally) every payment.</summary>
/// <param name="LoanAmount">The amount being repaid.</param>
/// <param name="MonthlyPayment">The scheduled principal-and-interest payment.</param>
/// <param name="ExtraMonthlyPrincipal">Extra principal paid each month on top of it (zero except when keeping today's payment).</param>
/// <param name="NumberOfPayments">How many payments it takes.</param>
/// <param name="TotalInterest">All interest paid.</param>
/// <param name="TotalPaid">All principal and interest paid.</param>
/// <param name="PayoffDate">The due date of the last payment.</param>
/// <param name="Payments">Every payment, in order; empty when the request asked for summaries only.</param>
public sealed record RefinanceOptionResponse(
    decimal LoanAmount,
    decimal MonthlyPayment,
    decimal ExtraMonthlyPrincipal,
    int NumberOfPayments,
    decimal TotalInterest,
    decimal TotalPaid,
    DateOnly PayoffDate,
    IReadOnlyList<LoanPaymentResponse> Payments);

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
