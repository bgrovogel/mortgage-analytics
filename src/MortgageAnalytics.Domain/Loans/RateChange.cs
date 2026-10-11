namespace MortgageAnalytics.Domain.Loans;

/// <summary>A new interest rate that applies from one payment on (an adjustable-rate loan resetting).</summary>
/// <param name="FromPaymentNumber">The first payment charged at the new rate.</param>
/// <param name="AnnualInterestRate">The new nominal annual rate, as a percentage.</param>
public sealed record RateChange(int FromPaymentNumber, decimal AnnualInterestRate);
