using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Mapping;

/// <summary>How a loan's payments are figured, for the response: the loan (with any rate resets), any buydown, and an adjustable rate's worst case.</summary>
/// <param name="Loan">The loan as analyzed.</param>
/// <param name="Buydown">The temporary buydown, or null.</param>
/// <param name="WorstCase">The standard schedule if rates rise as far as an adjustable rate's caps allow, or null for a fixed rate.</param>
internal sealed record LoanRates(LoanTerms Loan, TemporaryBuydown? Buydown, AmortizationSchedule? WorstCase);
