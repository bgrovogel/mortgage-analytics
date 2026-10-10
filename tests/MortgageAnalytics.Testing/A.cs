using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Testing.Builders;

namespace MortgageAnalytics.Testing;

/// <summary>
/// Entry point for test data, so tests read naturally: <c>A.Request.WithMonthlyExtra(200)</c>, <c>A.Loan()</c>.
/// </summary>
public static class A
{
    /// <summary>A new request builder, starting from <see cref="ReferenceLoans.Standard"/>.</summary>
    public static AmortizationRequestBuilder Request => new();

    /// <summary>A new housing-costs builder with every cost at zero.</summary>
    public static HousingCostsRequestBuilder HousingCosts => new();

    /// <summary>Domain loan terms; defaults to <see cref="ReferenceLoans.Standard"/>.</summary>
    public static LoanTerms Loan(
        decimal principal = ReferenceLoans.Standard.LoanAmount,
        decimal annualInterestRate = ReferenceLoans.Standard.AnnualInterestRate,
        int termInMonths = ReferenceLoans.Standard.TermInMonths) =>
        new(principal, annualInterestRate, termInMonths, ReferenceLoans.FirstPaymentDate);

    /// <summary>The <see cref="ReferenceLoans.FivePercentDown"/> purchase.</summary>
    public static PropertyPurchase FivePercentDownPurchase =>
        new(ReferenceLoans.FivePercentDown.HomePrice, ReferenceLoans.FivePercentDown.DownPayment);
}
