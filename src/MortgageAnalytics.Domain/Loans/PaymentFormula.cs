namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// The standard annuity formula: M = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1).
/// </summary>
/// <remarks>
/// Implemented entirely in <see cref="decimal"/>. <see cref="Math.Pow"/> is avoided because it
/// works in <see cref="double"/> and would introduce binary floating-point error.
/// </remarks>
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

        var growth = Pow(1 + monthlyRate, numberOfPayments);
        return Money.Round(principal * monthlyRate * growth / (growth - 1));
    }

    /// <summary>Raises <paramref name="value"/> to a whole-number power by repeated squaring, in O(log n) multiplications.</summary>
    internal static decimal Pow(decimal value, int exponent)
    {
        var result = 1m;
        while (exponent > 0)
        {
            if ((exponent & 1) == 1)
                result *= value;
            value *= value;
            exponent >>= 1;
        }
        return result;
    }
}
