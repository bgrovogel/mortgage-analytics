using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Refinancing;

/// <summary>
/// The current loan side by side with a refinance, and what the refinance really saves or costs.
/// </summary>
/// <remarks>
/// A refinance restarts the amortization clock. Early payments are mostly interest again, so a lower
/// payment can still cost more in total; <see cref="MonthsAdded"/> and <see cref="LifetimeSavings"/> show
/// that. <see cref="KeepingCurrentPayment"/> shows the way around it: keep paying today's amount.
/// </remarks>
/// <param name="Offer">The refinance offer.</param>
/// <param name="Current">The rest of the current loan, paid as scheduled.</param>
/// <param name="Refinanced">The new loan, paid as scheduled.</param>
/// <param name="KeepingCurrentPayment">
/// The new loan while still paying the current payment (the difference goes to principal), or null when
/// the new payment is not lower.
/// </param>
/// <param name="NewLoan">The new loan's terms, with any rate resets.</param>
/// <param name="BuydownCost">
/// What a buydown on the new loan costs, paid in cash at closing; 0 without one. It comes back as lower payments in
/// the buydown's years, so it is left out of the lifetime savings and the break-even, which it does not change.
/// </param>
/// <param name="CurrentPmiOrNone">The PMI on the current loan; null for none.</param>
/// <param name="NewPmiOrNone">The PMI on the new loan; null for none.</param>
/// <remarks>
/// PMI counts wherever the payment does: in the monthly savings, the lifetime totals and the break-even. A refinance
/// that restarts the clock keeps PMI longer, and one that borrows its closing costs can bring PMI back.
/// </remarks>
public sealed record RefinanceAnalysis(
    RefinanceOffer Offer,
    AmortizationSchedule Current,
    AmortizationSchedule Refinanced,
    AmortizationSchedule? KeepingCurrentPayment,
    LoanTerms NewLoan,
    decimal BuydownCost = 0m,
    LoanPmi? CurrentPmiOrNone = null,
    LoanPmi? NewPmiOrNone = null)
{
    /// <summary>The PMI on the current loan, or <see cref="LoanPmi.None"/>.</summary>
    public LoanPmi CurrentPmi => CurrentPmiOrNone ?? LoanPmi.None;

    /// <summary>The PMI on the new loan, or <see cref="LoanPmi.None"/>.</summary>
    public LoanPmi NewPmi => NewPmiOrNone ?? LoanPmi.None;

    /// <summary>PMI still to pay on the current loan.</summary>
    public decimal CurrentPmiTotal => CurrentPmi.TotalOn(Current);

    /// <summary>PMI on the new loan, paid as scheduled.</summary>
    public decimal RefinancedPmiTotal => NewPmi.TotalOn(Refinanced);

    /// <summary>PMI on the new loan while today's payment is kept up, or null when that option does not apply.</summary>
    public decimal? KeepingCurrentPaymentPmiTotal => KeepingCurrentPayment is null ? null : NewPmi.TotalOn(KeepingCurrentPayment);

    /// <summary>Cash due at closing: the closing costs unless they are financed, plus any buydown.</summary>
    public decimal CashAtClosing => Offer.UpfrontCosts + BuydownCost;

    /// <summary>How much lower the new payment is, PMI included. Negative when it is higher.</summary>
    public decimal MonthlySavings =>
        Current.InitialMonthlyPayment + CurrentPmi.FirstOn(Current) - (Refinanced.InitialMonthlyPayment + NewPmi.FirstOn(Refinanced));

    /// <summary>Interest on the rest of the current loan minus interest on the new loan.</summary>
    public decimal InterestSaved => Current.TotalInterest - Refinanced.TotalInterest;

    /// <summary>
    /// Everything still to pay on the current loan, PMI included, minus everything the refinance costs (payments, PMI
    /// and up-front closing costs). Negative when refinancing costs more over the life of the loan.
    /// </summary>
    public decimal LifetimeSavings => LifetimeSavingsOf(Refinanced);

    /// <summary>Lifetime savings when the current payment is kept up on the new loan; null when that option does not apply.</summary>
    public decimal? KeepingCurrentPaymentLifetimeSavings => KeepingCurrentPayment is null ? null : LifetimeSavingsOf(KeepingCurrentPayment);

    /// <summary>How many more payments the new loan takes than the current one has left. Negative when it pays off sooner.</summary>
    public int MonthsAdded => Refinanced.NumberOfPayments - Current.NumberOfPayments;

    /// <summary>
    /// The payment by which the interest (and PMI) saved so far first covers the closing costs, financed or not; null
    /// when it never does. This counts interest and PMI only, because principal repaid is not a cost. A simple
    /// "closing costs ÷ monthly savings" would overstate the benefit when costs are financed or the term is longer.
    /// </summary>
    public int? BreakEvenPaymentNumber { get; } = InterestBreakEven.PaymentNumber(
        Offer.ClosingCosts, Current, Refinanced, CurrentPmiOrNone ?? LoanPmi.None, NewPmiOrNone ?? LoanPmi.None);

    /// <summary>The due date of <see cref="BreakEvenPaymentNumber"/>, or null when there is none.</summary>
    public DateOnly? BreakEvenDate => BreakEvenPaymentNumber is { } number ? Refinanced.Payments[number - 1].DueDate : null;

    private decimal LifetimeSavingsOf(AmortizationSchedule refinanced) =>
        Current.TotalPaid + CurrentPmiTotal - (refinanced.TotalPaid + NewPmi.TotalOn(refinanced) + Offer.UpfrontCosts);
}
