using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Refinancing;

namespace MortgageAnalytics.Application.Mapping;

/// <summary>Maps between the refinance contracts and the domain. Pure functions, no state.</summary>
public static class RefinanceMapper
{
    /// <summary>The current loan as domain loan terms: what is owed, at what rate, over the payments left.</summary>
    /// <param name="request">A validated request.</param>
    /// <param name="defaultNextPaymentDate">Used when the request gives no next payment date.</param>
    public static LoanTerms ToCurrentLoan(this RefinanceRequest request, DateOnly defaultNextPaymentDate) =>
        new(request.CurrentBalance, request.CurrentAnnualInterestRate, request.RemainingTermInMonths,
            request.NextPaymentDate ?? defaultNextPaymentDate);

    /// <summary>The original loan as domain loan terms, or null when the request describes the loan as it is today.</summary>
    /// <param name="request">A validated request.</param>
    public static LoanTerms? ToOriginalLoan(this RefinanceRequest request) =>
        request.OriginalLoan is { } original
            ? new LoanTerms(original.Amount, request.CurrentAnnualInterestRate, original.TermInMonths, original.FirstPaymentDate)
            : null;

    /// <summary>The refinance offer as a domain value, with any adjustable rate (or its worst case) and buydown.</summary>
    /// <param name="request">A validated request.</param>
    /// <param name="worstCase">True to take an adjustable rate at the worst its caps allow.</param>
    public static RefinanceOffer ToOffer(this RefinanceRequest request, bool worstCase = false) =>
        new(request.NewAnnualInterestRate, request.NewTermInMonths, request.ClosingCosts, request.FinanceClosingCosts)
        {
            AdjustableRate = request.NewAdjustableRate.ToDomain(request.NewAnnualInterestRate, worstCase),
            Buydown = request.NewBuydown.ToDomain(),
        };

    /// <summary>Maps the analysis to the response contract.</summary>
    /// <param name="analysis">The domain result.</param>
    /// <param name="includePayments">False to leave out every payment row and keep only the summaries.</param>
    /// <param name="worstCaseLifetimeSavings">The lifetime savings if rates rise as far as the caps allow, when either loan adjusts.</param>
    public static RefinanceResponse ToResponse(this RefinanceAnalysis analysis, bool includePayments, decimal? worstCaseLifetimeSavings = null) =>
        new(
            ToResponse(analysis.Current, includePayments),
            ToResponse(analysis.Refinanced, includePayments),
            analysis.KeepingCurrentPayment is null ? null : ToResponse(analysis.KeepingCurrentPayment, includePayments),
            analysis.CashAtClosing,
            analysis.MonthlySavings,
            analysis.InterestSaved,
            analysis.LifetimeSavings,
            analysis.KeepingCurrentPaymentLifetimeSavings,
            analysis.MonthsAdded,
            analysis.BreakEvenPaymentNumber,
            analysis.BreakEvenDate,
            analysis.BuydownCost,
            analysis.Offer.Buydown is { } buydown ? ToResponse(buydown, analysis.NewLoan, analysis.BuydownCost) : null,
            worstCaseLifetimeSavings);

    /// <summary>The new loan's bought-down years, then the first at its note rate, and what the buydown costs.</summary>
    private static BuydownResponse ToResponse(TemporaryBuydown buydown, LoanTerms loan, decimal cost) =>
        new(
            loan.AnnualInterestRate,
            [.. Enumerable.Range(1, buydown.YearlyReductions.Count + 1)
                .Select(year => new BuydownYearResponse(year, buydown.RateForYear(loan, year), buydown.PaymentForYear(loan, year)))],
            cost);

    private static RefinanceOptionResponse ToResponse(AmortizationSchedule schedule, bool includePayments) =>
        new(
            schedule.TotalPrincipal,
            schedule.InitialMonthlyPayment,
            schedule.Payments[0].ExtraPrincipal,
            schedule.NumberOfPayments,
            schedule.TotalInterest,
            schedule.TotalPaid,
            schedule.PayoffDate,
            includePayments
                ? [.. schedule.Payments.Select(p => new LoanPaymentResponse(p.PaymentNumber, p.DueDate, p.Principal, p.Interest, p.ExtraPrincipal, p.RemainingBalance))]
                : [],
            [.. schedule.RateChanges.Select(c => new RateChangeResponse(
                c.PaymentNumber, schedule.Payments[c.PaymentNumber - 1].DueDate, c.PreviousRate, c.NewRate, c.PreviousPayment, c.NewPayment))]);
}
