using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Refinancing;

/// <summary>Compares keeping the current loan with refinancing it.</summary>
public interface IRefinanceAnalyzer
{
    /// <summary>Builds the current, refinanced and keep-the-payment schedules and compares them.</summary>
    /// <param name="current">The current loan as it stands today: balance, rate, payments left and next due date.</param>
    /// <param name="offer">The refinance offer.</param>
    /// <param name="pmi">The PMI each loan carries, from the home's value; null to leave PMI out.</param>
    /// <returns>The schedules and what refinancing saves or costs.</returns>
    RefinanceAnalysis Analyze(LoanTerms current, RefinanceOffer offer, RefinancePmi? pmi = null);
}

/// <summary>
/// Runs the same <see cref="IAmortizationCalculator"/> as the purchase analysis on each option, so every
/// schedule follows identical rounding rules. Stateless, so one instance can be shared.
/// </summary>
/// <param name="calculator">Builds each schedule.</param>
public sealed class RefinanceAnalyzer(IAmortizationCalculator calculator) : IRefinanceAnalyzer
{
    /// <inheritdoc />
    public RefinanceAnalysis Analyze(LoanTerms current, RefinanceOffer offer, RefinancePmi? pmi = null)
    {
        var currentSchedule = calculator.Generate(current, ExtraPaymentPlan.None, RecastPolicy.Never);

        // The new loan pays off the current balance (plus the closing costs, if financed) from the same next due date.
        var newLoan = new LoanTerms(offer.NewLoanAmount(current.Principal), offer.AnnualInterestRate, offer.TermInMonths, current.FirstPaymentDate)
            .WithAdjustableRate(offer.AdjustableRate);
        var refinanced = calculator.Generate(newLoan, ExtraPaymentPlan.None, RecastPolicy.Never);
        var currentPmi = pmi?.Current ?? LoanPmi.None;
        var newPmi = pmi?.For(newLoan) ?? LoanPmi.None;

        // Keeping today's payment means today's payment and PMI, less the new payment and PMI, goes to principal.
        var difference = currentSchedule.InitialMonthlyPayment + currentPmi.FirstOn(currentSchedule)
            - (refinanced.InitialMonthlyPayment + newPmi.FirstOn(refinanced));
        var keepingCurrentPayment = difference > 0
            ? calculator.Generate(newLoan, new ExtraPaymentPlan([new MonthlyExtraPayment(difference)]), RecastPolicy.Never)
            : null;

        var buydownCost = offer.Buydown is { } buydown
            ? buydown.TotalSubsidy(newLoan, refinanced)
            : 0m;

        return new RefinanceAnalysis(offer, currentSchedule, refinanced, keepingCurrentPayment, newLoan, buydownCost, currentPmi, newPmi);
    }
}
