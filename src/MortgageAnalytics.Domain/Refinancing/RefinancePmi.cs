using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Refinancing;

/// <summary>
/// What PMI a refinance's two loans carry, from the home's value today. Each is paid until its balance is 80% of that
/// value; the new loan needs it only above 80%, and by law not past its midpoint.
/// </summary>
/// <param name="HomeValue">What the home is worth today: the new loan's appraisal.</param>
/// <param name="CurrentMonthlyPremium">The PMI on the current loan's statement; 0 for none.</param>
/// <param name="NewAnnualRatePercent">The new loan's PMI rate, a yearly percentage of the loan, should it need PMI.</param>
public sealed record RefinancePmi(decimal HomeValue, decimal CurrentMonthlyPremium, decimal NewAnnualRatePercent)
{
    /// <summary>The PMI on the current loan.</summary>
    public LoanPmi Current => LoanPmi.OnCurrentLoan(CurrentMonthlyPremium, HomeValue);

    /// <summary>The PMI on <paramref name="newLoan"/>.</summary>
    public LoanPmi For(LoanTerms newLoan) => LoanPmi.ForNewLoan(newLoan.Principal, HomeValue, NewAnnualRatePercent, newLoan.TermInMonths);
}
