using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// Discount points, a permanent buydown: a fee paid at closing, a percentage of the loan ("one point" is 1%), for a
/// lower rate for the whole loan. Whether they pay is a comparison with the rate the lender offers without them.
/// </summary>
public sealed record DiscountPoints
{
    /// <summary>The most points accepted. Lenders rarely sell more, and a Qualified Mortgage caps all points and fees at about 3%.</summary>
    public const decimal MaxPoints = 5m;

    /// <summary>Creates the points, rejecting a count or rate no lender offers.</summary>
    /// <param name="points">The points paid, as a percentage of the loan.</param>
    /// <param name="rateWithoutPoints">The rate the lender offers without them, as a percentage.</param>
    /// <exception cref="DomainValidationException">No points, more than five, or a rate outside what a loan may have.</exception>
    public DiscountPoints(decimal points, decimal rateWithoutPoints)
    {
        if (points is <= 0 or > MaxPoints)
            throw new DomainValidationException($"Points must be more than 0 and at most {MaxPoints}.");
        if (rateWithoutPoints is <= 0 or > LoanTerms.MaxAnnualInterestRate)
            throw new DomainValidationException($"The rate without points must be more than 0% and at most {LoanTerms.MaxAnnualInterestRate}%.");

        Points = points;
        RateWithoutPoints = rateWithoutPoints;
    }

    /// <summary>The points paid, as a percentage of the loan.</summary>
    public decimal Points { get; }

    /// <summary>The rate the lender offers without points.</summary>
    public decimal RateWithoutPoints { get; }

    /// <summary>What the points cost at closing: the percentage of the loan, to the cent.</summary>
    /// <param name="loanAmount">The amount borrowed.</param>
    public decimal CostFor(decimal loanAmount) => Money.Round(loanAmount * Points / 100m);

    /// <summary>
    /// Compares the loan bought down with points against the same loan at <see cref="RateWithoutPoints"/>, each on its
    /// standard schedule (no extra payments), so the answer is about the points alone.
    /// </summary>
    /// <param name="loanAmount">The amount borrowed.</param>
    /// <param name="withPoints">The standard schedule at the lower rate.</param>
    /// <param name="withoutPoints">The standard schedule at <see cref="RateWithoutPoints"/>.</param>
    public PointsComparison Compare(decimal loanAmount, AmortizationSchedule withPoints, AmortizationSchedule withoutPoints)
    {
        var cost = CostFor(loanAmount);
        return new PointsComparison(
            cost,
            withoutPoints.InitialMonthlyPayment - withPoints.InitialMonthlyPayment,
            withoutPoints.TotalInterest - withPoints.TotalInterest,
            InterestBreakEven.PaymentNumber(cost, withoutPoints, withPoints));
    }
}

/// <summary>What discount points are worth against the rate without them.</summary>
/// <param name="Cost">What they cost at closing.</param>
/// <param name="MonthlySaving">How much lower the monthly principal and interest is.</param>
/// <param name="InterestSaved">The interest saved over the whole loan.</param>
/// <param name="BreakEvenPayment">The payment by which the interest saved covers the cost, or null when it never does.</param>
public sealed record PointsComparison(decimal Cost, decimal MonthlySaving, decimal InterestSaved, int? BreakEvenPayment)
{
    /// <summary>The interest saved, less what the points cost: negative when they lose money.</summary>
    public decimal NetSaving => InterestSaved - Cost;
}
