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

    /// <summary>The refinance offer as a domain value.</summary>
    /// <param name="request">A validated request.</param>
    public static RefinanceOffer ToOffer(this RefinanceRequest request) =>
        new(request.NewAnnualInterestRate, request.NewTermInMonths, request.ClosingCosts, request.FinanceClosingCosts);

    /// <summary>Maps the analysis to the response contract.</summary>
    /// <param name="analysis">The domain result.</param>
    /// <param name="includePayments">False to leave out every payment row and keep only the summaries.</param>
    public static RefinanceResponse ToResponse(this RefinanceAnalysis analysis, bool includePayments) =>
        new(
            ToResponse(analysis.Current, includePayments),
            ToResponse(analysis.Refinanced, includePayments),
            analysis.KeepingCurrentPayment is null ? null : ToResponse(analysis.KeepingCurrentPayment, includePayments),
            analysis.Offer.UpfrontCosts,
            analysis.MonthlySavings,
            analysis.InterestSaved,
            analysis.LifetimeSavings,
            analysis.KeepingCurrentPaymentLifetimeSavings,
            analysis.MonthsAdded,
            analysis.BreakEvenPaymentNumber,
            analysis.BreakEvenDate);

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
                : []);
}
