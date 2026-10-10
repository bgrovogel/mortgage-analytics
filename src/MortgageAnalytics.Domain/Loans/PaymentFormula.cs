namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// The standard annuity formula: M = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1).
/// </summary>
/// <remarks>Implemented entirely in <see cref="decimal"/>, using <see cref="DecimalMath.Pow"/>.</remarks>
public static class PaymentFormula
{
    /// <summary>Calculates the level monthly payment that repays a loan exactly over its term.</summary>
    /// <param name="principal">The amount to repay.</param>
    /// <param name="monthlyRate">The periodic rate as a fraction (0.005 for 6% a year).</param>
    /// <param name="numberOfPayments">How many monthly payments remain.</param>
    /// <returns>The payment, rounded to cents. At 0% it is simply principal ÷ payments.</returns>
    /// <exception cref="DomainValidationException"><paramref name="numberOfPayments"/> is zero or negative.</exception>
    public static decimal MonthlyPayment(decimal principal, decimal monthlyRate, int numberOfPayments)
    {
        if (numberOfPayments <= 0)
            throw new DomainValidationException("Number of payments must be greater than zero.");

        if (monthlyRate == 0)
            return Money.Round(principal / numberOfPayments);

        var growth = DecimalMath.Pow(1 + monthlyRate, numberOfPayments);
        return Money.Round(principal * monthlyRate * growth / (growth - 1));
    }
}
