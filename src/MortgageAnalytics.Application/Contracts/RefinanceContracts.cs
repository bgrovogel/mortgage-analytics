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
    /// Cash to take out of the home's equity at closing, borrowed on top of the balance. 0 for a refinance that only
    /// changes the rate or term. With <see cref="HomeValue"/>, the response says whether the new loan is above the 80%
    /// of the value a cash-out refinance allows.
    /// </summary>
    /// <example>0</example>
    public decimal CashOut { get; init; }

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

    /// <summary>
    /// Discount points bought on the new loan: a fee, a percentage of what is borrowed before any financed costs, paid with the
    /// closing costs (financed with them when they are) for a lower rate. <see cref="NewAnnualInterestRate"/> is then the rate
    /// with the points, and these say the rate the lender offers without them. Only for a fixed rate. Omit for none.
    /// </summary>
    public DiscountPointsRequest? NewDiscountPoints { get; init; }

    /// <summary>
    /// A home-equity loan for the <see cref="CashOut"/>, kept beside the current loan, to compare with refinancing to take
    /// the cash out. Needs <see cref="CashOut"/>. Omit for no comparison.
    /// </summary>
    public HomeEquityLoanRequest? HomeEquityLoan { get; init; }
}

/// <summary>
/// The cash taken out, borrowed as a second loan and repaid on its own schedule: a fixed-rate home-equity loan, or, with a
/// <see cref="DrawPeriodInMonths"/>, a home-equity line of credit (drawn at once, interest only, then repaid).
/// </summary>
public sealed record HomeEquityLoanRequest
{
    /// <summary>The home-equity loan's annual interest rate, as a percentage. For a line of credit, the rate while it is drawn.</summary>
    /// <example>8</example>
    public decimal AnnualInterestRate { get; init; }

    /// <summary>Its term in months, up to 30 years. For a line of credit, the months it is repaid over once the draw period ends.</summary>
    /// <example>180</example>
    public int TermInMonths { get; init; }

    /// <summary>
    /// For a line of credit, the months it is drawn, paying only interest, before repayment begins, up to 30 years. 0 for a
    /// loan, which is repaid from the start.
    /// </summary>
    /// <example>0</example>
    public int DrawPeriodInMonths { get; init; }

    /// <summary>
    /// For a line of credit, the rate expected once repayment begins, as a percentage: a line's rate moves with the market, so
    /// the rate while it is drawn is not necessarily the one it is repaid at. Omit to keep <see cref="AnnualInterestRate"/>.
    /// </summary>
    /// <example>9</example>
    public decimal? RepaymentRate { get; init; }

    /// <summary>How many years the two ways are costed over, from 1 to 30: what is paid in them and what is still owed after.</summary>
    /// <example>7</example>
    public int YearsKept { get; init; } = 7;
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
/// <param name="CashOut">The cash taken out at closing, borrowed on top of the balance; 0 for none. Counted in <paramref name="LifetimeSavings"/> as money in hand.</param>
/// <param name="NetCash">The cash in hand after closing: <paramref name="CashOut"/> less what is paid at closing. Negative when more is paid than received.</param>
/// <param name="NewLoanToValuePercent">The new loan as a percentage of the home's value; null without a home value.</param>
/// <param name="ExceedsCashOutLimit">True when cash is taken out and the new loan is above 80% of the home's value.</param>
/// <param name="HomeEquity">The home-equity loan compared with the cash-out refinance, when the request asked for it; otherwise null.</param>
/// <param name="Points">What the new loan's discount points are worth against the rate without them, when the request bought some; otherwise null.</param>
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
    decimal? WorstCaseLifetimeSavings,
    decimal CashOut = 0m,
    decimal NetCash = 0m,
    decimal? NewLoanToValuePercent = null,
    bool ExceedsCashOutLimit = false,
    HomeEquityResponse? HomeEquity = null,
    RefinancePointsResponse? Points = null);

/// <summary>
/// Whether the new loan's discount points pay: two loans of the same size (any other financed costs in both, the points paid
/// at closing), one at the rate with the points and one at the rate without, each on its standard schedule. About the points
/// alone, so PMI and extra payments are left out.
/// </summary>
/// <param name="Points">The points bought, as a percentage of what is borrowed.</param>
/// <param name="Cost">What they cost at closing.</param>
/// <param name="RateWithPoints">The new loan's rate, with the points.</param>
/// <param name="RateWithoutPoints">The rate the lender offers without them.</param>
/// <param name="PaymentWithPoints">The monthly principal and interest with the points.</param>
/// <param name="PaymentWithoutPoints">The same without them.</param>
/// <param name="MonthlySaving">How much lower the payment is with the points.</param>
/// <param name="InterestSaved">The interest the points save over the whole loan.</param>
/// <param name="NetSaving">The interest saved, less what the points cost; negative when they lose money.</param>
/// <param name="BreakEvenPayment">The payment by which the interest saved covers the cost, or null when it never does.</param>
/// <param name="BreakEvenDate">The due date of that payment, or null.</param>
public sealed record RefinancePointsResponse(
    decimal Points,
    decimal Cost,
    decimal RateWithPoints,
    decimal RateWithoutPoints,
    decimal PaymentWithPoints,
    decimal PaymentWithoutPoints,
    decimal MonthlySaving,
    decimal InterestSaved,
    decimal NetSaving,
    int? BreakEvenPayment,
    DateOnly? BreakEvenDate);

/// <summary>Taking the cash out as a home-equity loan beside the current loan, against refinancing to take it out.</summary>
/// <param name="Amount">The cash borrowed.</param>
/// <param name="AnnualInterestRate">The home-equity loan's rate.</param>
/// <param name="TermInMonths">Its term.</param>
/// <param name="YearsKept">The years both ways are costed over.</param>
/// <param name="AvailableEquity">What could be borrowed against the home: 80% of its value less what is owed; 0 when there is none. Null without a home value.</param>
/// <param name="CombinedLoanToValuePercent">What is owed plus the cash, as a percentage of the home's value. Null without a home value.</param>
/// <param name="ExceedsLimit">True when what is owed plus the cash is above 80% of the home's value.</param>
/// <param name="KeepAndBorrow">Keeping the current loan and borrowing the cash as a home-equity loan.</param>
/// <param name="CashOutRefinance">Refinancing to take the cash out, as the rest of this response prices it.</param>
/// <param name="SavedByEquityLoan">What the home-equity loan saves: the refinance's cost less the other way's. Negative when it costs more.</param>
/// <param name="DrawPeriodInMonths">The months a line of credit is drawn, interest only; 0 for a loan.</param>
/// <param name="RepaymentRate">The rate it is repaid at: a loan's rate, or the rate expected once a line's repayment begins.</param>
/// <param name="RepaymentPayment">Its monthly payment once it is being repaid: a loan's payment from the start, a line's after the draw period.</param>
public sealed record HomeEquityResponse(
    decimal Amount,
    decimal AnnualInterestRate,
    int TermInMonths,
    int YearsKept,
    decimal? AvailableEquity,
    decimal? CombinedLoanToValuePercent,
    bool ExceedsLimit,
    HomeEquityOptionResponse KeepAndBorrow,
    HomeEquityOptionResponse CashOutRefinance,
    decimal SavedByEquityLoan,
    int DrawPeriodInMonths,
    decimal RepaymentRate,
    decimal RepaymentPayment);

/// <summary>One way of getting the cash, costed over the years kept.</summary>
/// <param name="MonthlyPayment">What is paid each month at first: every loan's payment, PMI included.</param>
/// <param name="EquityLoanPayment">Of which the home-equity loan's (a line's, while it is drawn: interest only); 0 for the refinance.</param>
/// <param name="Payments">Everything paid in the years kept, PMI included.</param>
/// <param name="StillOwed">What is still owed on every loan after them.</param>
/// <param name="UpfrontCosts">Cash paid at closing: a refinance's closing costs; none are counted for a home-equity loan.</param>
/// <param name="Cost">Payments, plus what is still owed, plus the upfront costs: what getting the cash comes to.</param>
public sealed record HomeEquityOptionResponse(
    decimal MonthlyPayment,
    decimal EquityLoanPayment,
    decimal Payments,
    decimal StillOwed,
    decimal UpfrontCosts,
    decimal Cost);

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
