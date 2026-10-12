using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Mapping;

/// <summary>How a loan's payments are figured, for the response: the loan (with any rate resets), any buydown, and an adjustable rate's worst case.</summary>
/// <param name="Loan">The loan as analyzed.</param>
/// <param name="Buydown">The temporary buydown, or null.</param>
/// <param name="WorstCase">The standard schedule if rates rise as far as an adjustable rate's caps allow, or null for a fixed rate.</param>
/// <param name="BuydownPaidBy">Who pays for the buydown: the seller or builder unless the request says the borrower.</param>
/// <param name="Points">Discount points, or null.</param>
/// <param name="WithoutPoints">The standard schedule at the rate without points, or null without them.</param>
/// <param name="Program">An FHA or VA loan's terms, or null for a conventional loan.</param>
internal sealed record LoanRates(
    LoanTerms Loan, TemporaryBuydown? Buydown, AmortizationSchedule? WorstCase, BuydownPayer BuydownPaidBy = BuydownPayer.Seller,
    DiscountPoints? Points = null, AmortizationSchedule? WithoutPoints = null, GovernmentLoan? Program = null);
